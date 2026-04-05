// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title PokerNFTMarketplace
 * @notice ERC-721 NFT marketplace for poker avatars and cosmetics
 * @dev Minting, listing, buying with platform fee (2.9% standard, 2.0% for Platinum)
 */
contract PokerNFTMarketplace is ERC721, ERC721URIStorage, Ownable {
    uint256 private _nextTokenId;

    // Platform fee in basis points (290 = 2.9%, 200 = 2.0%)
    uint256 public defaultFeeBps = 290;

    struct Listing {
        address seller;
        uint256 price;
        bool active;
    }

    // tokenId => Listing
    mapping(uint256 => Listing) public listings;

    // Total fees collected (withdrawable by owner)
    uint256 public collectedFees;

    event AvatarMinted(uint256 indexed tokenId, address indexed to, string tokenURI);
    event Listed(uint256 indexed tokenId, address indexed seller, uint256 price);
    event Delisted(uint256 indexed tokenId);
    event Sold(uint256 indexed tokenId, address indexed buyer, address indexed seller, uint256 price, uint256 fee);

    constructor() ERC721("PokerAvatar", "PKAR") Ownable(msg.sender) {}

    /**
     * @notice Mint a new avatar NFT
     * @param to Address to mint to
     * @param uri IPFS URI for metadata
     */
    function mintAvatar(address to, string calldata uri) external onlyOwner returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
        emit AvatarMinted(tokenId, to, uri);
        return tokenId;
    }

    /**
     * @notice List an NFT for sale
     * @param tokenId Token to list
     * @param price Price in wei (MATIC)
     */
    function listForSale(uint256 tokenId, uint256 price) external {
        require(ownerOf(tokenId) == msg.sender, "Not the owner");
        require(price > 0, "Price must be > 0");
        require(!listings[tokenId].active, "Already listed");

        // Transfer NFT to marketplace contract for escrow
        transferFrom(msg.sender, address(this), tokenId);

        listings[tokenId] = Listing({
            seller: msg.sender,
            price: price,
            active: true
        });

        emit Listed(tokenId, msg.sender, price);
    }

    /**
     * @notice Buy a listed NFT
     * @param tokenId Token to buy
     * @param feeBps Fee in basis points (server passes 290 or 200 based on buyer tier)
     */
    function buyNFT(uint256 tokenId, uint256 feeBps) external payable {
        Listing storage listing = listings[tokenId];
        require(listing.active, "Not listed");
        require(msg.value >= listing.price, "Insufficient payment");
        require(msg.sender != listing.seller, "Cannot buy own listing");

        // Calculate fee
        uint256 fee = (listing.price * feeBps) / 10000;
        uint256 sellerPayout = listing.price - fee;

        listing.active = false;
        collectedFees += fee;

        // Transfer NFT to buyer
        _transfer(address(this), msg.sender, tokenId);

        // Pay seller
        payable(listing.seller).transfer(sellerPayout);

        // Refund excess payment
        if (msg.value > listing.price) {
            payable(msg.sender).transfer(msg.value - listing.price);
        }

        emit Sold(tokenId, msg.sender, listing.seller, listing.price, fee);
    }

    /**
     * @notice Cancel a listing (seller only)
     */
    function cancelListing(uint256 tokenId) external {
        Listing storage listing = listings[tokenId];
        require(listing.active, "Not listed");
        require(listing.seller == msg.sender, "Not the seller");

        listing.active = false;

        // Return NFT to seller
        _transfer(address(this), msg.sender, tokenId);

        emit Delisted(tokenId);
    }

    /**
     * @notice Withdraw collected platform fees (owner only)
     */
    function withdrawFees() external onlyOwner {
        uint256 amount = collectedFees;
        require(amount > 0, "No fees to withdraw");
        collectedFees = 0;
        payable(owner()).transfer(amount);
    }

    /**
     * @notice Update default fee (owner only)
     */
    function setDefaultFeeBps(uint256 newFeeBps) external onlyOwner {
        require(newFeeBps <= 1000, "Fee too high"); // Max 10%
        defaultFeeBps = newFeeBps;
    }

    // ── Required overrides ──────────────────────────────────────────────

    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
