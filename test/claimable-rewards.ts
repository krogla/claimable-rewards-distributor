import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers"
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs"
import { expect } from "chai"
import { ethers } from "hardhat"
import { Contract, utils, constants, BigNumber } from "ethers"

const { Zero } = constants
const reward = utils.parseUnits("100", 18) // 100 reward tokens, decimals = 18

describe("RewardsDistributorLib", function () {
    let ops: string[]
    let opRewards: Contract

    before(async function () {
        ops = (await ethers.getSigners()).slice(1, 6).map((s) => s.address)
    })

    beforeEach(async () => {
        const OperatorRewardsMock = await ethers.getContractFactory("OperatorRewardsMock")
        opRewards = await OperatorRewardsMock.deploy()
    })

    describe("OperatorRewardsMock", function () {
        it("happy path (3 operators)", async function () {
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

        it("Should revert disburse if no recipients", async function () {
            await expect(opRewards.disburseRewardsMock(reward)).to.be.revertedWith("zero total shares")
        })

        it("Should split reward according keys count", async function () {
            await opRewards.updateKeysMock(ops[0], 100) // add and remove
            await opRewards.updateKeysMock(ops[1], 25)
            await opRewards.updateKeysMock(ops[0], -100)

            await opRewards.disburseRewardsMock(reward)
            expect(await opRewards.getRewardsOwing(ops[0])).to.be.equal(0)
            expect(await opRewards.getRewardsOwing(ops[1])).to.be.equal(reward)
        })

        it("Should update internal counters on disburse and claim", async function () {
            await opRewards.updateKeysMock(ops[0], 75) // keys share = 3/4
            await opRewards.updateKeysMock(ops[1], 25) // keys share = 1/4

            expect(await opRewards.getRewardsTotalUnclaimed()).to.be.equal(0)
            expect(await opRewards.getRewardsOperatorClaimed(ops[0])).to.be.equal(0)
            expect(await opRewards.getRewardsOperatorClaimed(ops[1])).to.be.equal(0)
            expect(await opRewards.getRewardsOwing(ops[0])).to.be.equal(0)
            expect(await opRewards.getRewardsOwing(ops[1])).to.be.equal(0)

            await opRewards.disburseRewardsMock(reward)

            expect(await opRewards.getRewardsTotalUnclaimed()).to.be.equal(reward)
            expect(await opRewards.getRewardsOperatorClaimed(ops[0])).to.be.equal(0)
            expect(await opRewards.getRewardsOperatorClaimed(ops[1])).to.be.equal(0)
            expect(await opRewards.getRewardsOwing(ops[0])).to.be.equal(reward.mul(3).div(4))
            expect(await opRewards.getRewardsOwing(ops[1])).to.be.equal(reward.div(4))

            await opRewards.claimRewardFor(ops[0])
            await opRewards.claimRewardFor(ops[1])

            expect(await opRewards.getRewardsTotalUnclaimed()).to.be.equal(0)
            expect(await opRewards.getRewardsOperatorClaimed(ops[0])).to.be.equal(reward.mul(3).div(4))
            expect(await opRewards.getRewardsOperatorClaimed(ops[1])).to.be.equal(reward.div(4))
            expect(await opRewards.getRewardsOwing(ops[0])).to.be.equal(0)
            expect(await opRewards.getRewardsOwing(ops[1])).to.be.equal(0)
        })

        it("Should revert if nothing to claim", async function () {
            await opRewards.updateKeysMock(ops[0], 100)
            await opRewards.disburseRewardsMock(reward)
            await opRewards.claimRewardFor(ops[0])
            await expect(opRewards.claimRewardFor(ops[0])).to.be.revertedWith("nothing to claim")
        })

        it("adding keys after disburse should not affect owed reward", async function () {
            await opRewards.updateKeysMock(ops[0], 100) // keys share = 4/5
            await opRewards.updateKeysMock(ops[2], 25) // keys share = 1/5
            await opRewards.disburseRewardsMock(reward)
            await opRewards.updateKeysMock(ops[1], 75) // up share to 50%
            expect(await opRewards.getRewardsOwing(ops[0])).to.be.equal(reward.mul(4).div(5))
            expect(await opRewards.getRewardsOwing(ops[2])).to.be.equal(reward.div(5))
        })

        it("precision on big shares diff", async function () {
            await opRewards.updateKeysMock(ops[0], 11)
            await opRewards.updateKeysMock(ops[1], 999_999_989) // 1_000_000_000 - 11
            await opRewards.disburseRewardsMock(reward)
            expect(await opRewards.getRewardsOwing(ops[0])).to.be.equal(reward.mul(11).div(1_000_000_000))
            expect(await opRewards.getRewardsOwing(ops[1])).to.be.equal(reward.mul(999_999_989).div(1_000_000_000))
        })

        it("total unclaimed should be equal to sum of owing rewards", async function () {
            let keys = 10
            // add keys for each op
            for (const op of ops) {
                await opRewards.updateKeysMock(op, keys)
                keys *= 3
            }

            await opRewards.disburseRewardsMock(reward)

            expect(await opRewards.getRewardsTotalUnclaimed()).to.be.equal(reward)
            let totalOwing = Zero
            for (const op of ops) {
                totalOwing = totalOwing.add(await opRewards.getRewardsOwing(op))
            }

            // fix rounding error
            expect(fixRound(totalOwing)).to.be.equal(reward)
        })
    })
})

const fixRound = (x: BigNumber) => x.add(5).div(10).mul(10)
