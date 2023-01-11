import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers"
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs"
import { expect } from "chai"
import { ethers } from "hardhat"
import { Contract, utils, constants } from "ethers"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"

const { Zero } = constants
const reward = utils.parseUnits("100", 18) // 100 reward tokens, decimals = 18

describe("RewardsDistributorLib", function () {
    let ops: string[]
    let opRewards: Contract

    before(async function () {
        ops = (await ethers.getSigners()).slice(1, 5).map((s) => s.address)
    })

    beforeEach(async () => {
        const OperatorRewardsMock = await ethers.getContractFactory("OperatorRewardsMock")
        opRewards = await OperatorRewardsMock.deploy()
    })

    describe("OperatorRewardsMock", function () {
        it("happy path", async function () {
            await opRewards.updateKeysMock(ops[0], 100)
            await opRewards.updateKeysMock(ops[2], 25)

            // keys share: op[0]: 80%, op[1]: 0%, op[2]: 20%
            // reward 100 tokens: op[0]: +80, op[1]: 0, op[2]: +20
            // total owed: op[0]: 80, op[1]: 0, op[2]: 20
            await opRewards.disburseRewardsMock(reward)

            await opRewards.updateKeysMock(ops[1], 50)
            await opRewards.updateKeysMock(ops[2], 25)

            // keys share: op[0]: 50%, op[1]: 25%, op[2]: 25%
            // reward 100 tokens: op[0]: +50, op[1]: +25, op[2]: +25
            // total owed: op[0]: 130, op[1]: 25, op[2]: 45
            await opRewards.disburseRewardsMock(reward)

            await opRewards.claimRewardFor(ops[0])
            expect(await opRewards.getRewardsTotalUnclaimed()).to.be.equal(utils.parseEther("70"))
            expect(await opRewards.getRewardsOperatorClaimed(ops[0])).to.be.equal(utils.parseEther("130"))
            expect(await opRewards.getRewardsOperatorClaimed(ops[1])).to.be.equal(0)
            expect(await opRewards.getRewardsOperatorClaimed(ops[2])).to.be.equal(0)
            expect(await opRewards.getRewardsOwing(ops[0])).to.be.equal(0)
            expect(await opRewards.getRewardsOwing(ops[1])).to.be.equal(utils.parseEther("25"))
            expect(await opRewards.getRewardsOwing(ops[2])).to.be.equal(utils.parseEther("45"))

            // decrease keys
            // keys share: op[0]: 40%, op[1]: 18%, op[2]: 42%
            await opRewards.updateKeysMock(ops[1], -5)
            await opRewards.updateKeysMock(ops[2], 55)

            // again update keys while no rewards
            // keys share: op[0]: 40%, op[1]: 20%, op[2]: 40%
            await opRewards.updateKeysMock(ops[1], 5)
            await opRewards.updateKeysMock(ops[2], -5)

            // double disburse
            // keys share: op[0]: 40%, op[1]: 20%, op[2]: 40%
            // reward 200 tokens: op[0]: +80, op[1]: +40, op[2]: +80
            // total owed: op[0]: 210, op[1]: 65, op[2]: 125
            await opRewards.disburseRewardsMock(reward)
            await opRewards.disburseRewardsMock(reward)

            expect(await opRewards.getRewardsTotalUnclaimed()).to.be.equal(utils.parseEther("270"))
            expect(await opRewards.getRewardsOperatorClaimed(ops[0])).to.be.equal(utils.parseEther("130"))
            expect(await opRewards.getRewardsOperatorClaimed(ops[1])).to.be.equal(0)
            expect(await opRewards.getRewardsOperatorClaimed(ops[2])).to.be.equal(0)
            expect(await opRewards.getRewardsOwing(ops[0])).to.be.equal(utils.parseEther("80"))
            expect(await opRewards.getRewardsOwing(ops[1])).to.be.equal(utils.parseEther("65"))
            expect(await opRewards.getRewardsOwing(ops[2])).to.be.equal(utils.parseEther("125"))

            await opRewards.claimRewardFor(ops[0])
            await opRewards.claimRewardFor(ops[1])

            // keys share: op[0]: 63.5%, op[1]: 12.5%, op[2]: 25%
            await opRewards.updateKeysMock(ops[0], 150)

            await opRewards.claimRewardFor(ops[2])

            // keys share: op[0]: 70%, op[1]: 10%, op[2]: 20%
            await opRewards.updateKeysMock(ops[0], 100)

            // one more disburse
            // keys share: op[0]: 70%, op[1]: 10%, op[2]: 20%
            // reward 100 tokens: op[0]: +70, op[1]: +10, op[2]: +20
            // total owed: op[0]: 280, op[1]: 75, op[2]: 145
            await opRewards.disburseRewardsMock(reward)

            // random claim order
            await opRewards.claimRewardFor(ops[0])
            await opRewards.claimRewardFor(ops[2])
            await opRewards.claimRewardFor(ops[1])
            expect(await opRewards.getRewardsTotalUnclaimed()).to.be.equal(0)
            expect(await opRewards.getRewardsOperatorClaimed(ops[0])).to.be.equal(utils.parseEther("280"))
            expect(await opRewards.getRewardsOperatorClaimed(ops[1])).to.be.equal(utils.parseEther("75"))
            expect(await opRewards.getRewardsOperatorClaimed(ops[2])).to.be.equal(utils.parseEther("145"))
            expect(await opRewards.getRewardsOwing(ops[0])).to.be.equal(0)
            expect(await opRewards.getRewardsOwing(ops[1])).to.be.equal(0)
            expect(await opRewards.getRewardsOwing(ops[2])).to.be.equal(0)
        })

        it("Should revert if nothing to claim", async function () {
            await opRewards.updateKeysMock(ops[0], 100)
            await opRewards.disburseRewardsMock(reward)
            await opRewards.claimRewardFor(ops[0])
            await expect(opRewards.claimRewardFor(ops[0])).to.be.revertedWith("nothing to claim")
        })

        it("adding keys after disburse should not affect owed reward", async function () {
            await opRewards.updateKeysMock(ops[0], 100)
            await opRewards.updateKeysMock(ops[2], 25)
            await opRewards.disburseRewardsMock(reward)
            await opRewards.updateKeysMock(ops[1], 50)
            expect(await opRewards.getRewardsOwing(ops[0])).to.be.equal(utils.parseEther("80"))
            expect(await opRewards.getRewardsOwing(ops[2])).to.be.equal(utils.parseEther("20"))
        })

        it("total unclaimed should be equal to sum of owing rewards", async function () {
            let keys = 10
            // let totalKeys = 0
            for (const op of ops) {
                await opRewards.updateKeysMock(op, keys)
                // totalKeys + keys
                keys *= 2
            }
            await opRewards.disburseRewardsMock(reward)

            expect(await opRewards.getRewardsTotalUnclaimed()).to.be.equal(reward)
            let totalOwing = Zero
            for (const op of ops) {
                totalOwing = totalOwing.add(await opRewards.getRewardsOwing(op))
            }

            expect(totalOwing).to.be.equal(reward)
        })
    })
})
