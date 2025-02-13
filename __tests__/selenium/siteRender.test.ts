import { Builder, By, until } from 'selenium-webdriver';
import { Options as ChromeOptions } from 'selenium-webdriver/chrome';
import 'chromedriver';
import 'jest-styled-components';

jest.mock('openai', () => {
  return {
    OpenAI: jest.fn().mockImplementation(() => ({
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ text: 'Mocked completion response' }]
        })
      }
    }))
  };
});

describe('Site Render Tests', () => {
  let driver: any;

  beforeAll(async () => {
    const options = new ChromeOptions();
    options.addArguments('--headless');
options.addArguments('--no-sandbox');
options.addArguments('--disable-dev-shm-usage');
    driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(options)
      .build();
  });
  afterAll(async () => {
    if (driver) {
      await driver.quit();
    }
  }, 20000);

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
