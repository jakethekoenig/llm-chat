import { Builder, By, until } from 'selenium-webdriver';
import { Options as ChromeOptions } from 'selenium-webdriver/chrome';
import 'chromedriver';

describe('Site Render Tests', () => {
  let driver: any;

  beforeAll(async () => {
    const options = new ChromeOptions();
    options.addArguments('--headless');
    driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(options)
      .build();
  });

  afterAll(async () => {
    await driver.quit();
  });

  test('should open the site and check for console errors', async () => {
    await driver.get('http://localhost:3000');
    const logs = await driver.manage().logs().get('browser');
    const errorLogs = logs.filter((log: any) => log.level === 'SEVERE');
    expect(errorLogs.length).toBe(0);
  });

  test('should verify certain components are visible', async () => {
    await driver.get('http://localhost:5173');
    const header = await driver.findElement(By.css('header'));
    expect(await header.isDisplayed()).toBe(true);
  });
});
