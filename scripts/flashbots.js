const hre = require('hardhat');
const {
	FlashbotsBundleProvider,
} = require('@flashbots/ethers-provider-bundle');
const { BigNumber } = require('ethers');
const { ethers } = require('hardhat');
require('dotenv').config({ path: '.env' });

async function main() {
	// Deploy `FakeNFT` contract
	const fakeNFTContract = await ethers.getContractFactory('FakeNFT');
	const fakeNFT = await fakeNFTContract.deploy();
	await fakeNFT.deployed();
	console.log("FakeNFT contract's address:", fakeNFT.address);

	// Create an Alchemy Websocket Provider; using this bc we want to listen on every block, as no miners on testnet are flashbot miners; have to continually send bundle till it's included
	const provider = new ethers.providers.WebSocketProvider(
		process.env.ALCHEMY_WEBSOCKET_URL,
		'goerli'
	);

	// Wrap your private key in the ethers Wallet class
	const signer = new ethers.Wallet(process.env.GOERLI_PRIVATE_KEY, provider);

	// Create a Flashbots Provider which will forward the request to the relayer, which will then send it to the flashbot miner
	const flashbotsProvider = await FlashbotsBundleProvider.create(
		provider,
		signer,
		'https://relay-goerli.flashbots.net', // URL for flashbot relayer
		'goerli'
	);

	// Provider is "listening" for block events
	provider.on('block', async (blockNumber) => {
		console.log('Block Number:', blockNumber);

		// Send a bundle of txns to the flashbot relayer
		const bundleResponse = await flashbotsProvider.sendBundle(
			[
				{
					transaction: {
						chainId: 5, // Goerli chain ID
						type: 2, // EIP-1559 gas model
						value: ethers.utils.parseEther('0.01'), // Value of 1 FakeNFT
						to: fakeNFT.address, // Address of the FakeNFT
						data: fakeNFT.interface.getSighash('mint()'), // We pass the function selector of the mint function
						maxFeePerGas: BigNumber.from(10).pow(9).mul(3), // Max gas fees willing to pay (3 Gwei)
						maxPriorityFeePerGas: BigNumber.from(10).pow(9).mul(2), // Max Priority gas fees willing to pay (2 Gwei)
					},
					signer: signer,
				},
			],
			blockNumber + 1 // we want txn mined in the next block, so we add 1
		);

		// If an error is present, log that hoe
		if ('error' in bundleResponse) {
			console.log(bundleResponse.error.message);
		}
	});
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
