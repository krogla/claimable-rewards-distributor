// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {RewardsDistributorLib} from "../RewardsDistributorLib.sol";
import {ERC20Mock} from "./ERC20Mock.sol";

/// @dev NodeOperatorsRegistry as StakingModule with claimable rewards distribution mock contract
/// @author KRogLA <https://github.com/krogla>
contract OperatorRewardsMock {
    using RewardsDistributorLib for RewardsDistributorLib.ClaimDistribution;

    bytes32 internal constant STAKING_MODULE_CLAIM_DISTRIBUTION_POSITION = keccak256("lido.StakingModule.claimDistribution");

    event KeysUpdated(address indexed operator, uint256 keys, uint256 totalKeys);
    event RewardDisbursed(uint256 reward);
    event RewardClaimed(address indexed operator, uint256 reward);

    /// @dev operator's active keys mock store ***
    mapping(address => uint256) public activeKeys;
    uint256 public totalActiveKeys;

    /// @dev reward token mock
    ERC20Mock public rewardToken;

    /// @notice constructor creates ERC20Mock contract
    constructor() {
        rewardToken = new ERC20Mock();
    }

    /// @dev get total unclaimed rewards amount
    function getRewardsTotalUnclaimed() external view returns (uint256) {
        return _getStorageClaimDistribution().totalUnclaimedRewards;
    }

    /// @dev get operator's already claimed rewards amount
    function getRewardsOperatorClaimed(address operator) external view returns (uint256) {
        return _getStorageClaimDistribution().states[operator].claimedReward;
    }

    /// @dev get operator's owed rewards amount
    function getRewardsOwing(address operator) external view returns (uint256) {
        return _getStorageClaimDistribution().owing(operator, activeKeys[operator]);
    }

    /// @dev mock function to manipulate operator's keys amount
    /// @notice function takes both positive and negative values, no checks
    function updateKeysMock(address operator, int256 keysDelta) external {
        require(keysDelta != 0, "nothing to update");

        uint256 newActiveKeys = activeKeys[operator];
        uint256 newTotalActiveKeys = totalActiveKeys;

        _getStorageClaimDistribution().reserve(operator, newActiveKeys);

        // alternatively, we can automatically call `claimReward` when operator updates his keys:
        // claimRewardFor(operator);

        unchecked {
            newActiveKeys += uint256(keysDelta);
            newTotalActiveKeys += uint256(keysDelta);
        }

        activeKeys[operator] = newActiveKeys;
        totalActiveKeys = newTotalActiveKeys;

        emit KeysUpdated(operator, newActiveKeys, newTotalActiveKeys);
    }

    /// @dev mock function to simulate rewards disburse
    function disburseRewardsMock(uint256 reward) external {
        require(reward > 0, "nothing to disburse");

        rewardToken.mint(address(this), reward);

        _getStorageClaimDistribution().disburse(reward, totalActiveKeys);

        emit RewardDisbursed(reward);
    }

    /// @dev claim rewards for operator
    function claimRewardFor(address operator) public {
        uint256 owing = _getStorageClaimDistribution().claim(operator, activeKeys[operator]);
        require(owing > 0, "nothing to claim");

        bool success = rewardToken.transfer(operator, owing);
        require(success, "transfer failed");

        emit RewardClaimed(operator, owing);
    }

    /// @dev claim rewards if caller is operator
    function claimReward() external {
        claimRewardFor(msg.sender);
    }

    /// @dev helper for tests
    function rewardTokenBalance() external view returns (uint256) {
        return rewardToken.balanceOf(address(this));
    }

    /// @dev helper to get an unstructured storage slot
    function _getStorageClaimDistribution() internal pure returns (RewardsDistributorLib.ClaimDistribution storage _storage) {
        bytes32 position = STAKING_MODULE_CLAIM_DISTRIBUTION_POSITION;
        assembly {
            _storage.slot := position
        }
    }
}
