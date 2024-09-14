import { Builder, By, until } from 'selenium-webdriver';
import chrome, { Options } from 'selenium-webdriver/chrome'; // Import Options type
import 'chromedriver';

describe('Site Render Tests', () => {
  let driver: any;

  beforeAll(async () => {
    driver = await new Builder().forBrowser('chrome').setChromeOptions(new Options().headless()).build(); // Use Options type
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
    await driver.get('http://localhost:3000');
    const header = await driver.findElement(By.css('header'));
    const conversationList = await driver.findElement(By.css('.conversation-list'));
    const messageDemo = await driver.findElement(By.css('.message-demo'));

    expect(await header.isDisplayed()).toBe(true);
    expect(await conversationList.isDisplayed()).toBe(true);
    expect(await messageDemo.isDisplayed()).toBe(true);
  });
});