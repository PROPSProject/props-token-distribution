const Web3 = require('web3');
const zos = require('zos-lib');
// const BigNumber = require('bignumber.js');
const fs = require('fs');
// eslint-disable-next-line prefer-destructuring
const proxyContractABI = require('zos-lib/build/contracts/AdminUpgradeabilityProxy.json');
const propsTokenContractABI = require('../../build/contracts/PropsToken.json');
const connectionConfig = require('../../truffle');
const utils = require('../../scripts_utils/utils');

const networkProvider = process.argv[2];
const multisigWalletForPropsTokenProxy = process.argv[3];
const validators = String(process.argv[4]).split(",");
const tokenContract = process.argv[5];

let networkInUse;
let web3;

if (typeof (networkProvider) === 'undefined') {
  console.log('Must supply networkProvider');
  process.exit(0);
}

if (typeof (multisigWalletForPropsTokenProxy) === 'undefined') {
  console.log('Must supply multisigWalletForPropsTokenProxy');
  process.exit(0);
}

if (validators.length == 0) {
  console.log('Must supply validators comma delimited list');
  process.exit(0);  
}
let PropsTokenContractAddress;
if (tokenContract.length > 0) {
  PropsTokenContractAddress = tokenContract;
} else {
  const zosDataFileName = networkProvider === 'test' ? 'zos.dev-5777.json' : `zos.${networkProvider}.json`;
  const zosData = JSON.parse(fs.readFileSync(zosDataFileName, 'utf8'));
  PropsTokenContractAddress = zosData.proxies['PropsToken/PropsToken'][0].address;
}

console.log('1');

const multisigWalletABI = require('./MultiSigWallet.json');

const setupMetadataFilename = `output/setup-${networkProvider}.json`;
let setupData;
try {
  // eslint-disable-next-line import/no-dynamic-require,global-require
  setupData = require(`../../${setupMetadataFilename}`);
} catch (error) {
  setupData = {};
}
console.log('2');
if (typeof (setupData.steps) === 'undefined') {
  setupData.steps = [];
}

const setupDataEntry = {
  date: utils.timeStamp(),
};

async function main() {
  // instantiate multisig wallet
  console.log('3');
  let providerDevOps1;
  let DevOps1MultiSigOwnerAddress;
  networkInUse = networkProvider === 'test' ? networkProvider : `${networkProvider}1`;
  if (typeof connectionConfig.networks[networkInUse].provider === 'function') {
    providerDevOps1 = connectionConfig.networks[networkInUse].provider();
    web3 = new Web3(providerDevOps1);
  }
  if (typeof (connectionConfig.networks[networkInUse].wallet_address) === 'undefined') {
    web3 = new Web3(new Web3.providers.WebsocketProvider(`ws://${connectionConfig.networks[networkInUse].host}:${connectionConfig.networks[networkInUse].port}`));
    accounts = await web3.eth.getAccounts();
    // eslint-disable-next-line prefer-destructuring
    DevOps1MultiSigOwnerAddress = accounts[2];
  } else {
    DevOps1MultiSigOwnerAddress = connectionConfig.networks[networkInUse].wallet_address;
  }
  let multiSigContractInstance;
  if (multisigWalletForPropsTokenProxy != 'none') {
    console.log(`3.1 using multsigWallet >${multisigWalletForPropsTokenProxy}<`);
    multiSigContractInstance = new web3.eth.Contract(multisigWalletABI.abi, multisigWalletForPropsTokenProxy);
  }
  let propsContractInstance;
  console.log(`4 >${PropsTokenContractAddress}<`);  
  try {
    propsContractInstance = new web3.eth.Contract(propsTokenContractABI.abi, PropsTokenContractAddress);
  } catch (e) {
    console.log(`4 err ${JSON.stringify(e)}`);  
  }
  // const propsContractInstance = new web3.eth.Contract(proxyContractABI.abi, PropsTokenContractAddress);
  //get current rewards day
  //const rewardsStartVal = (await instance.methods.rewardsStartTimestamp().call());
  const rewardsTimestamp = await propsContractInstance.methods.rewardsStartTimestamp().call();
  const secondsInDay = networkProvider == 'mainnet' ? 86400 : 3600;
  console.log(`5 ${rewardsTimestamp}, ${secondsInDay}`);
  const currentTimestamp = Math.floor(Date.now()/1000);
  // return (block.timestamp.sub(_self.rewardsStartTimestamp)).div(_self.minSecondsBetweenDays).add(1);
  const rewardsDay = Math.floor((currentTimestamp - rewardsTimestamp) / secondsInDay) + 1;
  console.log(`Got rewardsTimestamp=${rewardsTimestamp}, secondsInDay=${secondsInDay}, currentTimestamp=${currentTimestamp}, rewardsDay=${rewardsDay}`);  
  
  const encodedData = await propsContractInstance.methods.setValidators(
    rewardsDay,
    validators
  ).encodeABI();

  const upgradeToEncoded = zos.encodeCall('setValidators', ['uint256','address[]'], [rewardsDay,validators]);

  console.log(`encodedData=${encodedData}`);
  if (multisigWalletForPropsTokenProxy === 'none') {
    await propsContractInstance.methods.setValidators(
      rewardsDay,
      validators,      
    ).send({
      from: DevOps1MultiSigOwnerAddress,
      gas: utils.gasLimit('deployJurisdiction'),
      gasPrice: utils.gasPrice(),
      // eslint-disable-next-line no-loop-func
    }).then((receipt) => {
      setupDataEntry.newValidators = validators;
      setupDataEntry.rewardsDay = rewardsDay;
      setupDataEntry.txHash = receipt.transactionHash;
      console.log(`Transaction for set validators ${JSON.stringify(receipt)}`);
    }).catch((error) => {
      console.warn(`Error sending transaction:${JSON.stringify(error)}`);
    });
  } else {
// const upgradeToEncoded = await propsContractInstance.methods.upgradeTo(NewPropsTokenLogicContractAddress)encodeABI();  
  // eslint-disable-next-line no-await-in-loop
  await multiSigContractInstance.methods.submitTransaction(
    PropsTokenContractAddress,
    0,
    upgradeToEncoded,
  ).send({
    from: DevOps1MultiSigOwnerAddress,
    gas: utils.gasLimit('setEntitiesViaMultisig'),
    gasPrice: utils.gasPrice(),
    // eslint-disable-next-line no-loop-func
  }).then((receipt) => {
    setupDataEntry.newValidators = validators;
    setupDataEntry.rewardsDay = rewardsDay;
    setupDataEntry.multisigTx = receipt.transactionHash;
    console.log('Multisig transaction for set validators');
  }).catch((error) => {
    console.warn(`Error sending multisig transaction:${error}`);
  });
  }
  

  setupData.steps.push(setupDataEntry);
  fs.writeFile(
    setupMetadataFilename,
    JSON.stringify(setupData),
    { flag: 'w' },
    (err) => {
      if (err) {
        console.error(err);
        process.exit(1);
      }
      console.log(`metadata written to ${setupMetadataFilename}`);
      console.log(JSON.stringify(setupData, null, 2));
      process.exit(0);
    },
  );
}

try {
  main();
} catch (err) {
  console.warn(err);
}
