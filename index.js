const puppeteer = require('puppeteer');
const config = require('config');
const log4js = require('log4js');
log4js.configure({
  appenders: { cheese: { type: 'file', filename: config.log.file } },
  categories: { default: { appenders: ['cheese'], level: 'debug' } }
});
const logger = log4js.getLogger('cheese');
const Sequelize = require('sequelize');
const sequelize = new Sequelize('dmm_crawler', config.db.user, config.db.password, {
  host : config.db.host,
  dialect: 'mysql'
});

(async () => {
  logger.debug("Logging start...");

  const browser = await puppeteer.launch({
    headless: true,
    //slowMo: 10      // 何が起こっているかを分かりやすくするため遅延
  });
  try {
    const page = await browser.newPage();

    // dmmにログイン
    await page.setViewport({ width: 1200, height: 800 }); // view portの指定
    await page.goto('https://mvno.dmm.com/mypage/-/datatraffic/', {
      timeout: 90000
    });
    await page.type('#login_id', config.login.id);
    await page.type('#password', config.login.password);
    const submitButton = await page.$('input[type=submit]');
    await submitButton.click();

    // db接続
    connectDb();

    // データ取得
    await page.waitForSelector('section.box-recentCharge tbody tr');
    const optionValues = await page.evaluate(() => {
      return Array.from(document.querySelector('#fn-number').options).map(option => option.value);
    });
    for (let optionValue of optionValues) {
      await changeSelect(page, optionValue);
      await crawlData(page);
    }
    await browser.close();
  } catch(e) {
    logger.error(e);
    await browser.close();
  }
  logger.debug("Logging end.");
  await process.exit();
})();

async function changeSelect(page, val) {
  await page.select('select#fn-number', val);
  await page.waitForSelector('section.box-recentCharge tbody tr');
};

async function getPhoneNumber(page) {
  return page.evaluate(() => {
    const select = document.querySelector('#fn-number');
    return select.options[select.selectedIndex].text.trim();
  });
}

async function crawlData(page) {
  await page.waitForSelector('section.box-recentCharge tbody tr');
  const phoneNumber = await getPhoneNumber(page);
  const data = await page.evaluate(() => {
    const trs = Array.from(document.querySelectorAll('section.box-recentCharge tbody tr'));
    return trs.map(tr => {
      return Array.from(tr.children).map((td, i) => {
        const data = td.textContent.trim();
        if (i == 0) return data;
        const num = data.match(/[\d|\.]+/)[0];
        const unit = data.replace(num, '');
        if (unit == 'GB') return parseFloat(num) * 1000;
        return parseFloat(num);
      });
    });
  });
  await saveData(phoneNumber, data);
}

function connectDb() {
  sequelize
    .authenticate()
    .then(() => {
      logger.debug('Connection has been established successfully.');
    })
    .catch(err => {
      logger.error('Unable to connect to the database:', err);
    });
}

async function saveData(phoneNumber, data) {
  const contract = await Contract.findOne({
    where: { phone_number: phoneNumber }
  });
  const contractId = contract.get('id');

  for (let d of data) {
    const oldLog = await TrafficLog.findOne({
      where: { contract_id: contractId, date: d[0] }
    });

    const val = { contract_id: contractId, date: d[0], traffic_fast: d[1], traffic_slow: d[2] };
    if (oldLog) {
      if (d[1] > oldLog.traffic_fast || d[2] > oldLog.traffic_slow) {
        await oldLog.update(val);
      }
    } else {
      await TrafficLog.create(val);
    }
  }
}

const Contract = sequelize.define('contracts', {
  phone_number: Sequelize.STRING,
  name: Sequelize.STRING
});

const TrafficLog = sequelize.define('traffic_logs', {
  contract_id: Sequelize.MEDIUMINT,
  date: Sequelize.DATEONLY,
  traffic_fast: Sequelize.FLOAT,
  traffic_slow: Sequelize.FLOAT
});
