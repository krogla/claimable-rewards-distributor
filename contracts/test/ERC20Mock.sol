// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

/// @dev minimal ERC20 mock contract
/// @author KRogLA <https://github.com/krogla>
contract ERC20Mock {
    uint8 public constant decimals = 18;

    event Transfer(address indexed src, address indexed dst, uint256 wad);

    mapping(address => uint256) public balanceOf;
    uint256 public totalSupply;

    function transfer(address dst, uint256 wad) external returns (bool) {
        return transferFrom(msg.sender, dst, wad);
    }

    function transferFrom(address src, address dst, uint256 wad) public returns (bool) {
        balanceOf[src] -= wad;
        balanceOf[dst] += wad;
        emit Transfer(src, dst, wad);
        return true;
    }

    function mint(address dst, uint256 wad) external {
        balanceOf[dst] += wad;
        totalSupply += wad;
        emit Transfer(address(0), dst, wad);
    }
}
