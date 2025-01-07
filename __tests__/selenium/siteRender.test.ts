import { Builder, By, until } from 'selenium-webdriver';
import { Options as ChromeOptions, ServiceBuilder } from 'selenium-webdriver/chrome';
import OpenAI from 'openai';
import { setMockCompletionResponse } from '../../__mocks__/openai';
import 'jest-styled-components';

jest.mock('openai');

beforeEach(() => {
  setMockCompletionResponse({
    choices: [{ text: 'Mocked completion response' }]
  });
});

describe('Site Render Tests', () => {
  let driver: any;

  beforeAll(async () => {
    // Increase timeout for driver initialization
    jest.setTimeout(30000);

    try {
      const options = new ChromeOptions();
      options.addArguments('--headless');
      options.addArguments('--no-sandbox');
      options.addArguments('--disable-dev-shm-usage');

      // Set up ChromeDriver service
      const service = new ServiceBuilder();

      driver = await new Builder()
        .forBrowser('chrome')
        .setChromeOptions(options)
        .setChromeService(service)
        .build();
    } catch (error) {
      console.error('Failed to initialize WebDriver:', error);
      throw error;
    }
  }, 30000); // Explicit timeout for beforeAll

  afterAll(async () => {
    if (driver) {
      try {
        await driver.quit();
      } catch (error) {
        console.error('Failed to quit WebDriver:', error);
      }
    }
  });

  test('should open the site and check for console errors', async () => {
    await driver.get('http://localhost:5173/showcase');
    const logs = await driver.manage().logs().get('browser');
    const errorLogs = logs.filter((log: any) => log.level === 'SEVERE');
    expect(errorLogs.length).toBe(0);
  }, 10000);

  test('should verify certain components are visible', async () => {
    await driver.get('http://localhost:5173/showcase');
    await driver.wait(until.elementLocated(By.css('header')), 10000); 
    const header = await driver.findElement(By.css('header'));
    expect(await header.isDisplayed()).toBe(true);
  }, 10000);
});
