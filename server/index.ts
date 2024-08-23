import express from 'express';
import jwt from 'jsonwebtoken';
import bodyParser from 'body-parser';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.SECRET_KEY || 'your_secret_key';

app.use(bodyParser.json());
app.use(cors());

// Mock user data
const users = [
  { id: 1, username: 'user1', password: 'password1' },
  { id: 2, username: 'user2', password: 'password2' }
];

// Sign-in route
app.post('/signin', (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username && u.password === password);
  if (user) {
    const token = jwt.sign({ id: user.id }, SECRET_KEY, { expiresIn: '1h' });
    res.json({ token });
  } else {
    res.status(401).send('Invalid credentials');
  }
});

// Middleware to verify token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Streaming endpoint
app.get('/get_completion', authenticateToken, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Example stream data with delays
  const messages = [
    'data: Example stream data part 1\n\n',
    'data: Example stream data part 2\n\n',
    'data: Example stream data part 3\n\n'
  ];

  let index = 0;
  const interval = setInterval(() => {
    if (index < messages.length) {
      res.write(messages[index]);
      index++;
    } else {
      clearInterval(interval);
      res.end();
    }
  }, 1000);
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});