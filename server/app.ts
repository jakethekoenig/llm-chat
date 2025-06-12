import express from 'express';
import jwt from 'jsonwebtoken';
import bodyParser from 'body-parser';
import cors from 'cors';
import bcrypt from 'bcrypt';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { User } from './database/models/User';
import { Op } from 'sequelize';
import { Conversation } from './database/models/Conversation';
import { Message } from './database/models/Message';
import { addMessage, generateCompletion, generateStreamingCompletion } from './helpers/messageHelpers';
import { body, validationResult } from 'express-validator';
import { 
  convertMessageToApiFormat, 
  convertConversationToApiFormat, 
  convertUserToApiFormat,
  convertIdToNumber 
} from './helpers/typeConverters';

const app = express();

// Get SECRET_KEY from environment - no fallback for security
const SECRET_KEY = process.env.SECRET_KEY;
if (!SECRET_KEY) {
  throw new Error('SECRET_KEY environment variable is required');
}

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// Rate limiting - more permissive in test environment
const isTestEnv = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isTestEnv ? 10000 : 100, // Much higher limit for tests
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: isTestEnv ? () => true : undefined, // Skip rate limiting in tests
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isTestEnv ? 10000 : 5, // Much higher limit for tests
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: isTestEnv ? () => true : undefined, // Skip rate limiting in tests
});

app.use(limiter);
app.use(bodyParser.json({ limit: '10mb' })); // Add size limit
app.use(cors());

// Standardized error response interface
interface ErrorResponse {
  error: string;
  message?: string;
  code?: string;
  details?: any;
  timestamp: string;
}

// Create standardized error response
const createErrorResponse = (
  error: string,
  message?: string,
  code?: string,
  details?: any
): ErrorResponse => ({
  error,
  message: message || error,
  code,
  details,
  timestamp: new Date().toISOString(),
});

// Global error handler middleware
const errorHandler = (
  err: any,
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  console.error('Error occurred:', err);

  // Handle validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json(
      createErrorResponse(
        'Validation failed',
        err.message,
        'VALIDATION_ERROR',
        err.errors
      )
    );
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json(
      createErrorResponse(
        'Invalid authentication token',
        err.message,
        'JWT_ERROR'
      )
    );
  }

  // Handle database errors
  if (err.name === 'SequelizeError') {
    return res.status(500).json(
      createErrorResponse(
        'Database error',
        'An error occurred while processing your request',
        'DATABASE_ERROR'
      )
    );
  }

  // Default error response
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal server error';
  
  res.status(status).json(
    createErrorResponse(
      status >= 500 ? 'Internal server error' : message,
      message,
      err.code || 'INTERNAL_ERROR'
    )
  );
};

// Async handler wrapper to catch async errors
const asyncHandler = (fn: Function) => (req: express.Request, res: express.Response, next: express.NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Middleware to verify token
export const authenticateToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json(
      createErrorResponse(
        'Authentication token required',
        'No authentication token provided',
        'TOKEN_REQUIRED'
      )
    );
  }

  jwt.verify(token, SECRET_KEY as jwt.Secret, {}, (err: jwt.VerifyErrors | null, decoded: string | jwt.JwtPayload | undefined) => {
    if (err || !decoded) {
      return res.status(403).json(
        createErrorResponse(
          'Invalid or expired token',
          'The provided authentication token is invalid or has expired',
          'TOKEN_INVALID'
        )
      );
    }
    (req as any).user = decoded;
    next();
  });
};

// Sign-in route
app.post('/api/signin', authLimiter, asyncHandler(async (req: express.Request, res: express.Response) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json(
      createErrorResponse(
        'Missing required fields',
        'Username and password are required',
        'MISSING_CREDENTIALS'
      )
    );
  }

  const user = await User.findOne({ where: { username } });
  
  if (!user || !(await bcrypt.compare(password, (user as any).hashed_password))) {
    return res.status(401).json(
      createErrorResponse(
        'Invalid credentials',
        'The provided username or password is incorrect',
        'INVALID_CREDENTIALS'
      )
    );
  }

  const token = jwt.sign({ id: (user as any).get('id') }, SECRET_KEY as jwt.Secret, { expiresIn: '1h' });
  res.json({ token });
}));

// Register route
app.post('/api/register', authLimiter, asyncHandler(async (req: express.Request, res: express.Response) => {
  const { username, email, password } = req.body;
  
  if (!username || !email || !password) {
    return res.status(400).json(
      createErrorResponse(
        'Missing required fields',
        'Username, email, and password are required',
        'MISSING_FIELDS'
      )
    );
  }

  const existingUser = await User.findOne({ where: { [Op.or]: [{ username }, { email }] } });
  
  if (existingUser) {
    return res.status(409).json(
      createErrorResponse(
        'User already exists',
        'A user with this username or email already exists',
        'USER_EXISTS'
      )
    );
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = await User.create({ username, email, hashed_password: hashedPassword });
  
  res.status(201).json({ 
    id: (newUser as any).get('id'), 
    username: (newUser as any).username, 
    email: (newUser as any).email 
  });
}));

// Add message submission endpoint
app.post('/api/add_message', authenticateToken, [
  body('content').notEmpty().withMessage('Content is required'),
  body('conversationId').custom((value) => {
    if (!value) throw new Error('Conversation ID is required');
    if (isNaN(parseInt(value))) throw new Error('Conversation ID must be a valid number');
    return true;
  }),
  body('parentId').optional().custom((value) => {
    if (value && isNaN(parseInt(value))) throw new Error('Parent ID must be an integer');
    return true;
  })
], asyncHandler(async (req: express.Request, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json(
      createErrorResponse(
        'Validation failed',
        'Please check your input and try again',
        'VALIDATION_ERROR',
        errors.array()
      )
    );
  }

  const { content, conversationId, parentId } = req.body;
  const userId = (req as any).user.id;

  const dbConversationId = convertIdToNumber(conversationId);
  const dbParentId = parentId ? convertIdToNumber(parentId) : null;
  const message = await addMessage(content, dbConversationId, dbParentId, userId);
  const formattedMessage = convertMessageToApiFormat(message);
  res.status(201).json(formattedMessage);
}));

// Get completion for message endpoint with validation
app.post('/api/get_completion_for_message', authenticateToken, [
  body('messageId').custom((value) => {
    if (!value) throw new Error('Message ID is required');
    if (isNaN(parseInt(value))) throw new Error('Message ID must be a valid number');
    return true;
  }),
  body('model').notEmpty().withMessage('Model is required'),
  body('temperature').isFloat().withMessage('Temperature must be a float')
], asyncHandler(async (req: express.Request, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json(
      createErrorResponse(
        'Validation failed',
        'Please check your input and try again',
        'VALIDATION_ERROR',
        errors.array()
      )
    );
  }

  const { messageId, model, temperature } = req.body;

  const dbMessageId = convertIdToNumber(messageId);
  const completionMessage = await generateCompletion(dbMessageId, model, temperature);
  res.status(201).json({ id: (completionMessage.get('id') as number).toString(), content: completionMessage.get('content') as string});
}));

// Streaming endpoint with validation
app.post('/api/get_completion', authenticateToken, [
  body('model').notEmpty().withMessage('Model is required'),
  body('parentId').custom((value) => {
    if (!value) throw new Error('Parent ID is required');
    if (isNaN(parseInt(value))) throw new Error('Parent ID must be a valid number');
    return true;
  }),
  body('temperature').isFloat().withMessage('Temperature must be a float')
], asyncHandler(async (req: express.Request, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json(
      createErrorResponse(
        'Validation failed',
        'Please check your input and try again',
        'VALIDATION_ERROR',
        errors.array()
      )
    );
  }

  const { model, parentId, temperature } = req.body;

  try {
    const dbParentId = convertIdToNumber(parentId);
    
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    req.on('close', () => {
      res.end();
    });

    for await (const chunk of generateStreamingCompletion(dbParentId, model, temperature)) {
      const data = JSON.stringify({
        messageId: chunk.messageId.toString(),
        chunk: chunk.chunk,
        isComplete: chunk.isComplete
      });
      res.write(`data: ${data}\n\n`);
      
      if (chunk.isComplete) {
        break;
      }
    }
    
    res.end();
  } catch (error) {
    console.error('Streaming error:', error);
    const errorData = JSON.stringify({ 
      error: 'Failed to generate completion',
      isComplete: true 
    });
    res.write(`data: ${errorData}\n\n`);
    res.end();
  }
}));

// Route to get all conversations for a logged-in user
app.get('/api/conversations', authenticateToken, asyncHandler(async (req: express.Request, res: express.Response) => {
  const userId = (req as any).user.id;
  const conversations = await Conversation.findAll({
    where: { user_id: userId }, // Ensure the user_id condition is applied
    include: [{
      model: Message,
      required: false
    }]
  });
  
  const formattedConversations = conversations.map(convertConversationToApiFormat);
  res.json(formattedConversations);
}));

// Route to get all messages in a specific conversation
app.get('/api/conversations/:conversationId/messages', authenticateToken, asyncHandler(async (req: express.Request, res: express.Response) => {
  const { conversationId } = req.params;
  const userId = (req as any).user.id;
  
  const dbConversationId = convertIdToNumber(conversationId);
  
  // Verify user has access to this conversation
  const conversation = await Conversation.findOne({
    where: { id: dbConversationId, user_id: userId }
  });
  
  if (!conversation) {
    return res.status(404).json(
      createErrorResponse(
        'Conversation not found',
        'The requested conversation does not exist or you do not have access to it',
        'CONVERSATION_NOT_FOUND'
      )
    );
  }
  
  const messages = await Message.findAll({
    where: { conversation_id: dbConversationId }
  });
  const formattedMessages = messages.map(convertMessageToApiFormat);
  res.json(formattedMessages);
}));

// Edit message endpoint
app.put('/api/messages/:messageId', authenticateToken, [
  body('content').notEmpty().withMessage('Content is required'),
], asyncHandler(async (req: express.Request, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json(
      createErrorResponse(
        'Validation failed',
        'Please check your input and try again',
        'VALIDATION_ERROR',
        errors.array()
      )
    );
  }

  const { messageId } = req.params;
  const { content } = req.body;
  const userId = (req as any).user.id;

  const dbMessageId = convertIdToNumber(messageId);
  const message = await Message.findByPk(dbMessageId);
  
  if (!message) {
    return res.status(404).json(
      createErrorResponse(
        'Message not found',
        'The requested message does not exist',
        'MESSAGE_NOT_FOUND'
      )
    );
  }

  // Check if user owns the message
  if (message.get('user_id') !== userId) {
    return res.status(403).json(
      createErrorResponse(
        'Access denied',
        'You can only edit your own messages',
        'ACCESS_DENIED'
      )
    );
  }

  // Update the message
  await message.update({ 
    content,
    timestamp: new Date()
  });

  const updatedMessage = convertMessageToApiFormat(message);
  res.json({
    id: updatedMessage.id,
    content: updatedMessage.content,
    timestamp: updatedMessage.timestamp
  });
}));

// Delete message endpoint
app.delete('/api/messages/:messageId', authenticateToken, asyncHandler(async (req: express.Request, res: express.Response) => {
  const { messageId } = req.params;
  const userId = (req as any).user.id;

  const dbMessageId = convertIdToNumber(messageId);
  const message = await Message.findByPk(dbMessageId);
  
  if (!message) {
    return res.status(404).json(
      createErrorResponse(
        'Message not found',
        'The requested message does not exist',
        'MESSAGE_NOT_FOUND'
      )
    );
  }

  // Check if user owns the message
  if (message.get('user_id') !== userId) {
    return res.status(403).json(
      createErrorResponse(
        'Access denied',
        'You can only delete your own messages',
        'ACCESS_DENIED'
      )
    );
  }

  // For now, we'll do a hard delete. In the future, we might want to implement soft delete
  // and handle cascade effects (what happens to child messages)
  await message.destroy();

  res.json({
    success: true,
    deletedMessageId: messageId
  });
}));

// Create conversation with initial message endpoint
app.post('/api/create_conversation', authenticateToken, [
  body('initialMessage').notEmpty().withMessage('Initial message is required'),
  body('model').notEmpty().withMessage('Model is required'),
  body('temperature').isFloat().withMessage('Temperature must be a float')
], asyncHandler(async (req: express.Request, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json(
      createErrorResponse(
        'Validation failed',
        'Please check your input and try again',
        'VALIDATION_ERROR',
        errors.array()
      )
    );
  }

  const { initialMessage, model, temperature } = req.body;
  const userId = (req as any).user.id;

  const defaultTitle = 'New Conversation';
  const conversation = await Conversation.create({ title: defaultTitle, user_id: userId });
  const message = await addMessage(initialMessage, conversation.get('id') as number, null, userId);
  const completionMessage = await generateCompletion(message.get('id') as number, model, temperature);
  res.status(201).json({ 
    conversationId: (conversation.get('id') as number).toString(), 
    initialMessageId: (message.get('id') as number).toString(), 
    completionMessageId: (completionMessage.get('id') as number).toString()
  });
}));

// Add global error handler middleware at the end
app.use(errorHandler);

export default app;
