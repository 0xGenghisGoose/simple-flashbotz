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

	// Create an Alchemy Websocket Provider
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

	provider.on('block', async (blockNumber) => {
		console.log('Block Number:', blockNumber);

		// Send a bundle of txns to the flashbot relayer
		const bundleResponse = await flashbotsProvider.sendBundle(
			[
				{
					transaction: {
						// ChainId for the Goerli network
						chainId: 5,
						// EIP-1559
						type: 2,
						// Value of 1 FakeNFT
						value: ethers.utils.parseEther('0.01'),
						// Address of the FakeNFT
						to: fakeNFT.address,
						// In the data field, we pass the function selctor of the mint function
						data: fakeNFT.interface.getSighash('mint()'),
						// Max gas fees you are willing to pay
						maxFeePerGas: BigNumber.from(10).pow(9).mul(3),
						// Max Priority gas fees you are willing to pay
						maxPriorityFeePerGas: BigNumber.from(10).pow(9).mul(2),
					},
					signer: signer,
				},
			],
			blockNumber + 1
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
