import {Router} from "express";
import {requireAllRoles} from "@/middleware/auth";
import {Season} from "@/helpers/models/season/season";
import {APIError} from "@/helpers/api-error";
import {parseModelPatch} from "@/helpers/patch";
import {ContractType, ContractTypeSchema} from "@/helpers/models/contracts/contract-type";
import {readRateLimiter, writeRateLimiter} from "@/helpers/rate-limit";
import {ContractSchema} from "@/helpers/models/contracts/contract";
import {SignUpSchema} from "@/helpers/models/season/signup";

const router = Router();

router.post("/seasons/:id/contract-types", writeRateLimiter, requireAllRoles(["admin"]), async (req, res) => {
    // allow contract types to be added to a season as long as the season is not completed
    const season = await req.em.findOne(Season, req.params.id);
    if (season === null) throw new APIError(404, "Season not found");
    if (season.completed) throw new APIError(400, "Cannot add contract types to a completed season");
    const result = parseModelPatch(req.body, ContractTypeSchema);
    const contractType = req.em.create(ContractTypeSchema, result, {partial: true});
    contractType.season = season.id;

    if (contractType.assignmentStart < new Date()) throw new APIError(400, "Assignment start must be in the future");
    if (contractType.assignmentEnd < contractType.assignmentStart) throw new APIError(400, "Assignment end must be after assignment start");
    if (contractType.reviewDeadline < contractType.assignmentEnd) throw new APIError(400, "Review deadline must be after assignment end");
    if (contractType.discordChannelId === undefined) throw new APIError(400, "Discord channel ID is required");

    await req.em.flush();
    res.json({success: true, contractType});
});

router.get("/seasons/:id/contract-types", readRateLimiter, async (req, res) => {
    const contractTypes = await req.em.find(ContractTypeSchema, {season: req.params.id});
    res.json({success: true, contractTypes});
});

router.post("/seasons/:id/contract-types/:slug/contracts", writeRateLimiter, requireAllRoles(["admin"]), async (req, res) => {
    const result = parseModelPatch(req.body, ContractSchema, {excludeForeignKeyFields: false, partial: false, exclude: ["season", "contractType", "name", "progress", "score", "reviewContent", "verdict"]});
    // must refer to existing contract type
    const season = await Season.getSeasonById(req.em, req.params.id as string);
    if (season === null) throw new APIError(404, "Season not found");
    const contractType = await ContractType.getContractTypeById(req.em, season.id.toString(), req.params.slug as string);
    if (contractType === null) throw new APIError(404, "Contract type not found");
    // must be distinct signed up participants
    if (result.contractor === result.contractee) throw new APIError(400, "Contractor and contractee must be distinct");
    const contractorSignup = await req.em.findOne(SignUpSchema, {season: season.id, user: result.contractor}, {populate: ["user"]});
    const contracteeSignup = await req.em.findOne(SignUpSchema, {season: season.id, user: result.contractee}, {populate: ["user"]});
    if (contractorSignup === null || contracteeSignup === null) throw new APIError(400, "Both contractor and contractee must be signed up");
    console.log(result);
    const contract = req.em.create(ContractSchema, result, {partial: true});
    contract.contractType = contractType;
    contract.season = season.id;
    await req.em.flush();
    await contract
    res.json({success: true, contract});
});

export default router;