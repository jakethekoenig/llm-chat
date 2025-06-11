import express from 'express';
import jwt from 'jsonwebtoken';
import bodyParser from 'body-parser';
import cors from 'cors';
import bcrypt from 'bcrypt';
import { User } from './database/models/User';
import { Op } from 'sequelize';
import { Conversation } from './database/models/Conversation';
import { Message } from './database/models/Message';
import { addMessage, generateCompletion } from './helpers/messageHelpers';
import { body, validationResult } from 'express-validator';

const app = express();
const SECRET_KEY = process.env.SECRET_KEY || 'fallback-secret-key';

app.use(bodyParser.json());
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
app.post('/api/signin', asyncHandler(async (req: express.Request, res: express.Response) => {
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
app.post('/api/register', asyncHandler(async (req: express.Request, res: express.Response) => {
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
  body('conversationId').isInt().withMessage('Conversation ID must be an integer'),
  body('parentId').optional().isInt().withMessage('Parent ID must be an integer')
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

  const message = await addMessage(content, conversationId, parentId, userId);
  res.status(201).json({ id: message.get('id') });
}));

// Get completion for message endpoint with validation
app.post('/api/get_completion_for_message', authenticateToken, [
  body('messageId').isInt().withMessage('Message ID must be an integer'),
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

  const completionMessage = await generateCompletion(messageId, model, temperature);
  res.status(201).json({ id: completionMessage.get('id'), content: completionMessage.get('content')});
}));

// Streaming endpoint with validation
app.post('/api/get_completion', authenticateToken, [
  body('model').notEmpty().withMessage('Model is required'),
  body('parentId').isInt().withMessage('Parent ID must be an integer'),
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

  const completionMessage = await generateCompletion(parentId, model, temperature);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const streamData = JSON.stringify({ id: completionMessage.get('id'), content: completionMessage.get('content')});
  res.write(`data: ${streamData}\n\n`);

  // Placeholder for actual streaming logic
  const messages = [
    { chunk: 'Example stream data part 1' },
    { chunk: 'Example stream data part 2' },
    { chunk: 'Example stream data part 3' }
  ];

  let index = 0;
  const interval = setInterval(() => {
    if (index < messages.length) {
      const chunkData = JSON.stringify(messages[index]);
      res.write(`data: ${chunkData}\n\n`);
      index++;
    } else {
      clearInterval(interval);
      res.end();
    }
  }, 1000);
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
  res.json(conversations);
}));

// Route to get all messages in a specific conversation
app.get('/api/conversations/:conversationId/messages', authenticateToken, asyncHandler(async (req: express.Request, res: express.Response) => {
  const { conversationId } = req.params;
  const userId = (req as any).user.id;
  
  // Verify user has access to this conversation
  const conversation = await Conversation.findOne({
    where: { id: conversationId, user_id: userId }
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
    where: { conversation_id: conversationId }
  });
  res.json(messages);
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
    conversationId: conversation.get('id'), 
    initialMessageId: message.get('id'), 
    completionMessageId: completionMessage.get('id') 
  });
}));

// Add global error handler middleware at the end
app.use(errorHandler);

export default app;
