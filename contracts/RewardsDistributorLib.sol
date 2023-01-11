// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

/// @notice Math lib is used for precision mulDiv
import {Math} from "./lib/Math.sol";

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
        mapping(address => ClaimState) states;
    }

    /// @dev returns owing reward amount for specified account and it's share
    /// @param _self var instanse
    /// @param _account - account address (e.g. operator's address)
    /// @param _share - current account share (e.g. current operator's active keys)
    function owing(ClaimDistribution storage _self, address _account, uint256 _share) internal view returns (uint256) {
        ClaimState storage state = _self.states[_account];
        return Math.mulDiv(_self.totalRewardPoints - state.lastRewardPoints, _share, POINT_MULTIPLIER) + state.owedReward;
        // return (((_self.totalRewardPoints - state.lastRewardPoints) * _share) / POINT_MULTIPLIER) + state.owedReward;
    }

    /// @dev hook, should be called before any updates of the account's share
    /// @param _self - var instanse
    /// @param _account - account address (e.g. operator's address)
    /// @param _share - current account share before update (e.g. current operator's active keys)
    function reserve(ClaimDistribution storage _self, address _account, uint256 _share) internal {
        ClaimState storage state = _self.states[_account];
        state.owedReward = owing(_self, _account, _share);
        state.lastRewardPoints = _self.totalRewardPoints;
    }

    /// @dev hook, should be called on reward disburse
    /// @param _self - var instanse
    /// @param _reward - reward amount
    /// @param _totalShares - current sum of account's shares, i.e. current total shares (e.g. )
    function disburse(ClaimDistribution storage _self, uint256 _reward, uint256 _totalShares) internal {
        require(_reward > 0);
        uint rewardPoints = Math.mulDiv(_reward, POINT_MULTIPLIER, _totalShares);
        _self.totalRewardPoints += rewardPoints;
        _self.totalUnclaimedRewards += _reward;
    }

    /// @dev hook, should be called on reward claim
    /// @param _self - var instanse
    /// @param _account - account address (e.g. operator's address)
    /// @param _share - current account share (e.g. current operator's active keys)
    function claim(ClaimDistribution storage _self, address _account, uint256 _share) internal returns (uint256 _claimed) {
        _claimed = owing(_self, _account, _share);
        if (_claimed > 0) {
            ClaimState storage state = _self.states[_account];
            state.lastRewardPoints = _self.totalRewardPoints;
            state.owedReward = 0;
            state.claimedReward += _claimed;
            _self.totalUnclaimedRewards -= _claimed;
        }
    }
}
