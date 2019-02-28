/* eslint-disable no-useless-concat */
/* eslint-disable no-use-before-define */
const htmlToText = require('html-to-text');
const AWS = require('aws-sdk');

const outputDataFile = process.argv[2]; // require('../../output/test_output.json');

if (typeof (outputDataFile) === 'undefined') {
  console.warn('Must supply distribution output file');
  process.exit(0);
}

// eslint-disable-next-line import/no-dynamic-require
const outputData = require(`../../${outputDataFile}`);

AWS.config.update({ region: 'us-east-1' });


const network = 'rinkeby';

for (let i = 0; i < outputData.allocations.length; i += 1) {
  const recipient = outputData.allocations[i];
  // eslint-disable-next-line no-continue
  if (recipient.email !== 'jon@younow.com') continue;
  const body = prepareBody(recipient);
  const params = prepareEmail(recipient.email, body, 'Props Token Distribution Confirmation', 'support@propsproject.com');
  if (recipient.email === 'jon@younow.com') {
    sendEmail(params);
  }
  // sendEmail(params);
  console.log(params.Message.Body.Text.Data);
  process.exit();
  // console.log(params);
}

function prepareBody(recipient) {
  let body = '';
  body += `Hi ${recipient.firstName},`;
  body += '<br><br>';
  body += 'Thank you for supporting Props. Your Props Tokens have been successfully distributed to the ';
  body += 'wallet address you provided. You’ll find a detailed summary of your Props holdings below: ';
  body += '<br><br>';
  body += '<ul>';
  body += `${'<li>' + 'Ethereum address: '}${etherscan(recipient.beneficiary)}</li>`;
  if (recipient.investedAmount) {
    body += `${'<li>' + 'Amount contributed in USD: $'}${parseInt(recipient.investedAmount, 10).toLocaleString('en')}</li>`;
  }
  body += '<li>' + 'Initial Token price: $0.136904' + '</li>';
  if (recipient.investedDiscount) {
    body += `${'<li>' + 'Your discount: '}${recipient.investedDiscount}%` + `</li>`;
    body += `${'<li>' + 'Your discounted Token price: $'}${discountedPrice(recipient.investedDiscount)}</li>`;
  }
  if (recipient.investedAmount) {
    body += `${'<li>' + 'Initial Token allocation: '}${initialTokens(recipient.totalTokens)}</li>`;
    body += '</ul>';
    body += 'As you remember, we chose to reward our early investors with a 10% bonus in March 2018. ';
    body += 'Given that bonus, your token allocation has increased:';
    body += '<br><br>';
    body += '<ul>';
    body += `${'<li>' + 'Bonus Tokens: '}${roundDown(parseFloat(recipient.totalTokens, 10) - initialTokens(recipient.totalTokens), 2)}</li>`;
  }
  body += `${'<li>' + 'Your total Token allocation: '}${recipient.totalTokens}</li>`;
  if (recipient.investedAmount) {
    body += `${'<li>' + 'Your final Token price: $'}${roundDown(discountedPrice(recipient.investedDiscount) / 1.1, 6)}</li>`;
  }
  body += '</ul>';
  if (recipient.vestingContractAddress) {
    body += '<b>Your Vesting Schedule</b>';
    body += '<br><br>';
    body += 'Your Props are subject to a vesting schedule governed by a unique Smart Vesting Contract, which you own. ';
    if (recipient.vestingPercentage < 100) {
      body += `You already have access to ${100 - recipient.vestingPercentage}% of your Props. `;
    }
    body += 'The Contract will unlock your remaining tokens on a linear schedule (ie. more tokens will vest on a daily basis).';
    body += '<br><br>';
    body += '<ul>';
    body += `${'<li>' + 'Vesting contract address: '}${etherscan(recipient.vestingContractAddress)}</li>`;
    body += `${'<li>' + 'Vesting length: '}${recipient.vestingDuration} Days` + `</li>`;
    if (recipient.vestingCliff) {
      body += `${'<li>' + 'Vesting cliff: '}${recipient.vestingCliff} Days` + `</li>`;
    }
    body += '</ul>';
    body += `Moving forward, visit the Props ${vestingUrl(recipient, 'Vesting Dashboard')} to see details `;
    body += 'on your vesting schedule, and confirm how many of your tokens have vested. You may transfer ';
    body += 'vested tokens to your address at any time. ';
    body += '<br><br>';
  }
  body += '<b>Viewing your Token Balance</b>';
  body += '<br><br>';
  body += 'To view your token balance using <a href="https://metamask.io/">MetaMask</a> or ';
  body += '<a href="https://www.myetherwallet.com/">MyEtherWallet</a>, tap “Add Token,” and use the following parameters:';
  body += '<br><br>';
  body += '<ul>';
  body += `${'<li>' + 'Token contract address: '}${etherscan(outputData.tokenContractAddress)}</li>`;
  body += '<li>' + 'Token symbol: PROPS' + '</li>';
  body += '<li>' + 'Decimals of precision: 18' + '</li>';
  body += '</ul>';
  body += '<b>Using Your Props</b>';
  body += '<br><br>';
  body += 'As a Props holder, you can immediately unlock unique features and premium functionality in the ';
  body += '<a href="https://www.younow.com">YouNow</a> app, as you can see in this ';
  body += '<a href="https://www.youtube.com/watch?v=dQw4w9WgXcQ">demonstration</a>. Simply visit ';
  body += '<a href="https://www.younow.com/props">younow.com/props</a> on the web, and link your wallet address to your ';
  body += ' YouNow account. Additional functionality will roll out in the months ahead, when we begin rewarding the ';
  body += 'platform\'s content creators and users with Props. Note that some transfers of tokens may be limited under state law.';
  body += '<br><br>';
  body += 'Thank you for joining and contributing to the Props Project. We look forward to working closely with you, ';
  body += 'as we further build out the Props Network.';
  body += '<br><br>';
  body += 'If you have any questions, please write to team@propsproject.com, and we’ll get back to you as quickly as possible.';
  body += '<br><br>';
  body += 'Thank you,<br>';
  body += 'Team Props';
  body += '<br><br>';
  body += '<small>Legal disclaimer: No money or other consideration is being solicited in connection with an offering under Regulation A of the Securities Act of 1933, as amended (“Regulation A”), and if sent in response, will not be accepted. No offer to buy Props Tokens under Regulation A can be accepted and no part of any purchase price can be received until an offering statement is qualified pursuant to the Securities Act of 1933, as amended, and any such offer may be withdrawn or revoked, without obligation or commitment of any kind, at any time before notice of its acceptance given after the qualification date. A person\'s indication of interest involves no obligation or commitment of any kind.</small>';
  return body;
}

function vestingUrl(recipient, text) {
  return `<a href="https://vesting.propsproject.com/${recipient.vestingContractAddress}/${outputData.tokenContractAddress}">${text}</a>`;
}

function etherscan(address) {
  const subdomain = network === 'mainnet' ? 'www' : network;
  return `<a href="https://${subdomain}.etherscan.io/address/${address}">${address}</a>`;
}

function discountedPrice(discount) {
  return roundDown(0.136904 * ((100 - parseInt(discount, 10)) / 100), 6);
}

function initialTokens(tokens) {
  return roundDown(parseFloat(tokens, 10) / 110 * 100, 2);
}

function roundDown(num, decimals) {
  const multiplier = Math.pow(10, decimals);
  return Math.floor(num * multiplier) / multiplier;
}

function prepareEmail(to, body, subject, from) {
  return {
    Destination: { /* required */
      ToAddresses: [
        to,
        /* more items */
      ],
    },
    Message: { /* required */
      Body: { /* required */
        Html: {
          Charset: 'UTF-8',
          Data: body,
        },
        Text: {
          Charset: 'UTF-8',
          Data: htmlToText.fromString(body, {}),
        },
      },
      Subject: {
        Charset: 'UTF-8',
        Data: subject,
      },
    },
    Source: from, /* required */
  };
}

function sendEmail(params) {  
  const sendPromise = new AWS.SES({ apiVersion: '2010-12-01' }).sendEmail(params).promise();
  sendPromise.then(
    (data) => {
      console.log(data);
      console.log(data.MessageId);
    },
  ).catch(
    (err) => {
      console.error(err, err.stack);
    },
  );
}