// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

/// @notice Math lib is used for precision mulDiv
// import {Math} from "./lib/Math.sol";

import "hardhat/console.sol";

/// @dev claimable rewards distribution core logic lib
/// @author KRogLA <https://github.com/krogla>

library RewardsDistributorLib {
    using RewardsDistributorLib for ClaimDistribution;

    uint256 private constant POINT_MULTIPLIER = 1 ether; // 10 ** 18

    struct ClaimState {
        uint256 claimedReward;
        uint256 owedReward;
        uint256 lastRewardPoints;
    }

    struct ClaimDistribution {
        uint256 totalRewardPoints;
        uint256 totalUnclaimedRewards;
        uint256 rewardsDust;
        mapping(address => ClaimState) states;
    }

    /// @dev returns summary unclaimed reward amount
    /// @param _self var instanse
    /// @return amount
    function getUnclimed(ClaimDistribution storage _self) internal view returns (uint256) {
        return _self.totalUnclaimedRewards + _self.rewardsDust;
    }

    /// @dev returns total claimed reward amount for specified account
    /// @param _self var instanse
    /// @param _account - account address (e.g. operator's address)
    /// @return amount
    function getClaimed(ClaimDistribution storage _self, address _account) internal view returns (uint256) {
        return _self.states[_account].claimedReward;
    }

    /// @dev returns owing reward amount for specified account and it's share
    /// @param _self var instanse
    /// @param _account - account address (e.g. operator's address)
    /// @param _share - current account share (e.g. current operator's active keys)
    /// @return amount
    function getOwing(ClaimDistribution storage _self, address _account, uint256 _share) internal view returns (uint256) {
        ClaimState storage state = _self.states[_account];
        // return Math.mulDiv(_self.totalRewardPoints - state.lastRewardPoints, _share, POINT_MULTIPLIER) + state.owedReward;
        (uint256 reward, uint256 pointsDust) = _owing(_self, _account, _share);
        reward += state.owedReward;
        // if (pointsDust > 0) {
        //     reward+= 1;
        // }
        return reward;
    }

    function _owing(ClaimDistribution storage _self, address _account, uint256 _share)
        internal
        view
        returns (uint256 reward, uint256 pointsDust)
    {
        ClaimState storage state = _self.states[_account];
        // return Math.mulDiv(_self.totalRewardPoints - state.lastRewardPoints, _share, POINT_MULTIPLIER) + state.owedReward;
        uint256 rewadPoints = (_self.totalRewardPoints - state.lastRewardPoints) * _share;
        reward = rewadPoints / POINT_MULTIPLIER;
        pointsDust = rewadPoints % POINT_MULTIPLIER;
    }

    /// @dev hook, should be called before any updates of the account's share
    /// @param _self - var instanse
    /// @param _account - account address (e.g. operator's address)
    /// @param _share - current account share before update (e.g. current operator's active keys)
    function reserve(ClaimDistribution storage _self, address _account, uint256 _share) internal {
        ClaimState storage state = _self.states[_account];
        // state.owedReward = getOwing(_self, _account, _share);
        // state.lastRewardPoints = _self.totalRewardPoints;
        (uint256 reward, uint256 pointsDust) = _owing(_self, _account, _share);
        state.owedReward += reward;

        if (pointsDust > 0) {
            console.log("dust", pointsDust);
            console.log("_reward", reward);
            console.log("_share", _share);
        }
        state.lastRewardPoints = _self.totalRewardPoints - pointsDust;
    }

    /// @dev hook, should be called on reward disburse
    /// @param _self - var instanse
    /// @param _reward - reward amount
    /// @param _totalShares - current sum of account's shares, i.e. current total shares (e.g. )
    function disburse(ClaimDistribution storage _self, uint256 _reward, uint256 _totalShares) internal {
        require(_totalShares > 0, "zero total shares");
        // uint256 rewardPoints = Math.mulDiv(_reward, POINT_MULTIPLIER, _totalShares);
        // _self.totalRewardPoints += rewardPoints;

        // uint256 rewardCheck = Math.mulDiv(rewardPoints, _totalShares, POINT_MULTIPLIER);
        uint256 rewardsDust = _self.rewardsDust;
        _reward += rewardsDust;
        uint256 rewardPoints = _reward * POINT_MULTIPLIER / _totalShares;
        uint256 rewardCheck = (rewardPoints * _totalShares / POINT_MULTIPLIER);

        rewardsDust = _reward - rewardCheck;

        if (rewardsDust > 0) {
            _reward -= rewardsDust;

            console.log("_reward", _reward);
            console.log("rewardPoints", rewardPoints);
            console.log("rewardsDust", rewardsDust);
        }
        _self.rewardsDust = rewardsDust;

        _self.totalUnclaimedRewards += _reward;
        _self.totalRewardPoints += rewardPoints;
    }

    /// @dev hook, should be called on reward claim
    /// @param _self - var instanse
    /// @param _account - account address (e.g. operator's address)
    /// @param _share - current account share (e.g. current operator's active keys)
    /// @return amount
    function claim(ClaimDistribution storage _self, address _account, uint256 _share) internal returns (uint256) {
        (uint256 reward, uint256 pointsDust) = _owing(_self, _account, _share);
        // _claimed = owing(_self, _account, _share);
        ClaimState storage state = _self.states[_account];
        reward += state.owedReward;
        if (reward > 0) {
            state.claimedReward += reward;
            _self.totalUnclaimedRewards -= reward;
        }
        state.lastRewardPoints = _self.totalRewardPoints - pointsDust;
        state.owedReward = 0;
        return reward;
    }
}
