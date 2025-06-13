import 'dotenv/config';
import app from './app';

// Environment validation
function validateEnvironment() {
  const requiredVars = {
    SECRET_KEY: 'JWT secret key for authentication'
  };

  const missingVars: string[] = [];
  
  for (const [varName, description] of Object.entries(requiredVars)) {
    if (!process.env[varName]) {
      missingVars.push(`${varName} (${description})`);
    }
  }

  // Check that at least one API key is set
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
  const hasOpenRouter = !!process.env.OPENROUTER_API_KEY;
  
  if (!hasOpenAI && !hasAnthropic && !hasOpenRouter) {
    missingVars.push('OPENAI_API_KEY, ANTHROPIC_API_KEY, or OPENROUTER_API_KEY (at least one LLM API key is required)');
  }

  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:');
    missingVars.forEach(varInfo => console.error(`  - ${varInfo}`));
    console.error('\nPlease check your .env file or environment variables.');
    console.error('See .env.example for reference.');
    process.exit(1);
  }

  // Validate SECRET_KEY strength
  const secretKey = process.env.SECRET_KEY;
  if (secretKey && secretKey.length < 32) {
    console.error('❌ SECRET_KEY must be at least 32 characters long for security');
    process.exit(1);
  }

  console.log('✅ Environment validation passed');
}

// Validate environment before starting server
validateEnvironment();

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📊 OpenAI API: ${process.env.OPENAI_API_KEY ? '✅ configured' : '❌ not set'}`);
  console.log(`📊 Anthropic API: ${process.env.ANTHROPIC_API_KEY ? '✅ configured' : '❌ not set'}`);
  console.log(`📊 OpenRouter API: ${process.env.OPENROUTER_API_KEY ? '✅ configured' : '❌ not set'}`);
});
