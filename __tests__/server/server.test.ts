import request from 'supertest';
import express from 'express';
import app, { authenticateToken } from '../../server/app';
import { sequelize } from '../../server/database/models';
import { up, down } from '../../server/database/seeders/20240827043208-seed-test-data.js';

beforeAll(async () => {
  await sequelize.sync({ force: true });
  await up();
});

afterAll(async () => {
  await down();
  await sequelize.close();
});

// Streaming endpoint
app.get('/get_completion', authenticateToken, (req: express.Request, res: express.Response) => {
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

describe('Server Tests', () => {
  it('should sign in and return a token', async () => {
    const response = await request(app)
      .post('/signin')
      .send({ username: 'user1', password: 'password1' });
    expect(response.status).toBe(200);
    expect(response.body.token).toBeDefined();
  });

  it('should return 401 for invalid credentials', async () => {
    const response = await request(app)
      .post('/signin')
      .send({ username: 'user1', password: 'wrongpassword' });
    expect(response.status).toBe(401);
  });

  it('should stream data for authenticated users', async () => {
    const signInResponse = await request(app)
      .post('/signin')
      .send({ username: 'user1', password: 'password1' });
    const token = signInResponse.body.token;

    const response = await request(app)
      .get('/get_completion')
      .set('Authorization', `Bearer ${token}`)
      .expect('Content-Type', /text\/event-stream/)
      .expect(200);

    expect(response.text).toContain('data: Example stream data part 1');
    expect(response.text).toContain('data: Example stream data part 2');
    expect(response.text).toContain('data: Example stream data part 3');
  });

  it('should return 401 for unauthenticated users', async () => {
    const response = await request(app).get('/get_completion');
    expect(response.status).toBe(401);
  });

  it('should return 403 for invalid token', async () => {
    const signInResponse = await request(app)
      .post('/signin')
      .send({ username: 'user1', password: 'password1' });
    const token = signInResponse.body.token;

    // Tamper the token to make it invalid
    const invalidToken = token ? token.slice(0, -1) + 'x' : 'invalidToken';

    const response = await request(app)
      .get('/get_completion')
      .set('Authorization', `Bearer ${invalidToken}`);
    expect(response.status).toBe(403);
  });
});