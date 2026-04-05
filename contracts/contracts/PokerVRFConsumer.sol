// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";

/**
 * @title PokerVRFConsumer
 * @notice Requests verifiable randomness from Chainlink VRF v2.5 for poker hands
 * @dev Inherits VRFConsumerBaseV2Plus for Polygon Amoy/Mainnet
 */
contract PokerVRFConsumer is VRFConsumerBaseV2Plus {
    // VRF configuration
    uint256 public s_subscriptionId;
    bytes32 public s_keyHash;
    uint32 public s_callbackGasLimit;
    uint16 public constant REQUEST_CONFIRMATIONS = 3;
    uint32 public constant NUM_WORDS = 1;

    // Mappings
    mapping(uint256 => uint256) public requestToRandomWord;
    mapping(uint256 => bool) public requestFulfilled;
    mapping(bytes32 => uint256) public handToRequestId;

    // Events
    event RandomnessRequested(uint256 indexed requestId, string tableId, uint256 handNumber);
    event RandomnessFulfilled(uint256 indexed requestId, uint256 randomWord);

    constructor(
        address vrfCoordinator,
        uint256 subscriptionId,
        bytes32 keyHash,
        uint32 callbackGasLimit
    ) VRFConsumerBaseV2Plus(vrfCoordinator) {
        s_subscriptionId = subscriptionId;
        s_keyHash = keyHash;
        s_callbackGasLimit = callbackGasLimit;
    }

    /**
     * @notice Request randomness for a specific poker hand
     * @param tableId The table identifier
     * @param handNumber The hand number at the table
     * @return requestId The VRF request ID
     */
    function requestRandomness(
        string calldata tableId,
        uint256 handNumber
    ) external onlyOwner returns (uint256 requestId) {
        bytes32 handKey = keccak256(abi.encodePacked(tableId, handNumber));
        require(handToRequestId[handKey] == 0, "Already requested");

        requestId = s_vrfCoordinator.requestRandomWords(
            VRFV2PlusClient.RandomWordsRequest({
                keyHash: s_keyHash,
                subId: s_subscriptionId,
                requestConfirmations: REQUEST_CONFIRMATIONS,
                callbackGasLimit: s_callbackGasLimit,
                numWords: NUM_WORDS,
                extraArgs: VRFV2PlusClient._argsToBytes(
                    VRFV2PlusClient.ExtraArgsV1({nativePayment: false})
                )
            })
        );

        handToRequestId[handKey] = requestId;
        emit RandomnessRequested(requestId, tableId, handNumber);
        return requestId;
    }

    /**
     * @notice Callback from Chainlink VRF with random words
     */
    function fulfillRandomWords(
        uint256 requestId,
        uint256[] calldata randomWords
    ) internal override {
        requestToRandomWord[requestId] = randomWords[0];
        requestFulfilled[requestId] = true;
        emit RandomnessFulfilled(requestId, randomWords[0]);
    }

    /**
     * @notice Get the random word for a fulfilled request
     * @param requestId The VRF request ID
     * @return The random word (0 if not fulfilled)
     */
    function getRandomWord(uint256 requestId) external view returns (uint256) {
        return requestToRandomWord[requestId];
    }

    /**
     * @notice Update VRF configuration
     */
    function updateConfig(
        uint256 subscriptionId,
        bytes32 keyHash,
        uint32 callbackGasLimit
    ) external onlyOwner {
        s_subscriptionId = subscriptionId;
        s_keyHash = keyHash;
        s_callbackGasLimit = callbackGasLimit;
    }
}
