import { Builder, By, until } from 'selenium-webdriver';
import { Options as ChromeOptions } from 'selenium-webdriver/chrome';
import chrome from 'selenium-webdriver/chrome';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const chromedriver = require('chromedriver');
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
    const options = new ChromeOptions();
    options.addArguments('--headless');
    options.addArguments('--no-sandbox');
    options.addArguments('--disable-dev-shm-usage');

    // Set up ChromeDriver path explicitly
    const service = new chrome.ServiceBuilder(chromedriver.path)
      .build();
    chrome.setDefaultService(service);

    driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(options)
      .build();
  });
  afterAll(async () => {
    await driver.quit();
  });

  test('should open the site and check for console errors', async () => {
    await driver.get('http://localhost:5173/showcase');
    const logs = await driver.manage().logs().get('browser');
    const errorLogs = logs.filter((log: any) => log.level === 'SEVERE');
    expect(errorLogs.length).toBe(0);
  });

  test('should verify certain components are visible', async () => {
    await driver.get('http://localhost:5173/showcase');
    await driver.wait(until.elementLocated(By.css('header')), 10000); 
    const header = await driver.findElement(By.css('header'));
    expect(await header.isDisplayed()).toBe(true);
  }, 20000);
});
