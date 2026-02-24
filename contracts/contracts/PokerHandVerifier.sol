// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title PokerHandVerifier
 * @notice On-chain commitment/reveal storage for provably fair poker hands
 * @dev Commitment stored after deal, reveal at showdown. Anyone can verify.
 */
contract PokerHandVerifier is Ownable {
    struct HandCommitment {
        bytes32 commitmentHash;
        uint256 vrfRequestId;
        uint256 commitTimestamp;
        bool committed;
    }

    struct HandReveal {
        string serverSeed;
        string[] playerSeeds;
        string deckOrder;
        uint256 revealTimestamp;
        bool revealed;
    }

    // tableId hash + handNumber => commitment/reveal
    mapping(bytes32 => HandCommitment) public commitments;
    mapping(bytes32 => HandReveal) private reveals;

    // Events
    event HandCommitted(
        string indexed tableId,
        uint256 indexed handNumber,
        bytes32 commitmentHash,
        uint256 vrfRequestId
    );

    event HandRevealed(
        string indexed tableId,
        uint256 indexed handNumber
    );

    constructor() Ownable(msg.sender) {}

    /**
     * @notice Commit to a hand's shuffle (called after deal, before showdown)
     */
    function commitHand(
        string calldata tableId,
        uint256 handNumber,
        bytes32 commitmentHash,
        uint256 vrfRequestId
    ) external onlyOwner {
        bytes32 key = _handKey(tableId, handNumber);
        require(!commitments[key].committed, "Already committed");

        commitments[key] = HandCommitment({
            commitmentHash: commitmentHash,
            vrfRequestId: vrfRequestId,
            commitTimestamp: block.timestamp,
            committed: true
        });

        emit HandCommitted(tableId, handNumber, commitmentHash, vrfRequestId);
    }

    /**
     * @notice Reveal hand data (called at showdown)
     */
    function revealHand(
        string calldata tableId,
        uint256 handNumber,
        string calldata serverSeed,
        string[] calldata playerSeeds,
        string calldata deckOrder
    ) external onlyOwner {
        bytes32 key = _handKey(tableId, handNumber);
        require(commitments[key].committed, "Not committed");
        require(!reveals[key].revealed, "Already revealed");

        reveals[key] = HandReveal({
            serverSeed: serverSeed,
            playerSeeds: playerSeeds,
            deckOrder: deckOrder,
            revealTimestamp: block.timestamp,
            revealed: true
        });

        emit HandRevealed(tableId, handNumber);
    }

    /**
     * @notice Verify a hand — anyone can call this
     * @return committed Whether the hand was committed
     * @return revealed Whether the hand was revealed
     * @return commitHash The commitment hash
     * @return timestamp The commit timestamp
     */
    function verifyHand(
        string calldata tableId,
        uint256 handNumber
    ) external view returns (
        bool committed,
        bool revealed,
        bytes32 commitHash,
        uint256 timestamp
    ) {
        bytes32 key = _handKey(tableId, handNumber);
        HandCommitment storage c = commitments[key];
        HandReveal storage r = reveals[key];
        return (c.committed, r.revealed, c.commitmentHash, c.commitTimestamp);
    }

    /**
     * @notice Get full hand data — anyone can call this
     */
    function getHandData(
        string calldata tableId,
        uint256 handNumber
    ) external view returns (
        string memory serverSeed,
        string[] memory playerSeeds,
        string memory deckOrder,
        bytes32 commitHash,
        uint256 vrfRequestId,
        uint256 commitTimestamp,
        uint256 revealTimestamp
    ) {
        bytes32 key = _handKey(tableId, handNumber);
        HandCommitment storage c = commitments[key];
        HandReveal storage r = reveals[key];
        return (
            r.serverSeed,
            r.playerSeeds,
            r.deckOrder,
            c.commitmentHash,
            c.vrfRequestId,
            c.commitTimestamp,
            r.revealTimestamp
        );
    }

    function _handKey(string calldata tableId, uint256 handNumber) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(tableId, handNumber));
    }
}
