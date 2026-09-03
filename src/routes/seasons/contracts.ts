import {Router} from "express";
import {requireAllRoles, requireAuth} from "@/middleware/auth";
import {Season} from "@/helpers/models/season/season";
import {APIError} from "@/helpers/api-error";
import {parseModelPatch} from "@/helpers/patch";
import {ContractType, ContractTypeSchema} from "@/helpers/models/contracts/contract-type";
import {readRateLimiter, writeRateLimiter} from "@/helpers/rate-limit";
import {Contract, ContractSchema} from "@/helpers/models/contracts/contract";
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
    const contract = req.em.create(ContractSchema, result, {partial: true});
    contract.contractType = contractType;
    contract.season = season.id;
    await req.em.flush();
    res.json({success: true, contract});
});

router.get("/seasons/:id/contracts", readRateLimiter, requireAuth, async (req, res) => {
    const season = await Season.getSeasonById(req.em, req.params.id as string);
    if (season === null) throw new APIError(404, "Season not found");

    const userRoles = req.auth!.roles.getItems();
    const isAdmin = userRoles.some(x => x.role === "admin");

    let contracts;
    if (isAdmin) {
        contracts = await req.em.find(Contract, {season: season.id}, {populate: ["contractor", "contractee", "contractType"], orderBy: {id: "asc"}});
    } else {
        contracts = await req.em.find(
            Contract,
            {
                season: season.id,
                $or: [
                    {contractor: req.auth!.id},
                    {contractee: req.auth!.id},
                ],
            },
            {populate: ["contractor", "contractee", "contractType"], orderBy: {id: "asc"}}
        );
    }

    res.json({success: true, contracts});
});

router.post("/seasons/:id/contract-types/:slug/auto-assign", writeRateLimiter, requireAllRoles(["admin"]), async (req, res) => {
    const season = await Season.getSeasonById(req.em, req.params.id as string);
    if (season === null) throw new APIError(404, "Season not found");
    if (season.completed) throw new APIError(400, "Cannot assign contracts for a completed season");

    const contractType = await ContractType.getContractTypeById(req.em, season.id.toString(), req.params.slug as string);
    if (contractType === null) throw new APIError(404, "Contract type not found");

    const signups = await req.em.find(SignUpSchema, {season: season.id}, {populate: ["user"]});
    if (signups.length < 2) {
        throw new APIError(400, "At least 2 participants required to auto-assign contracts");
    }

    // Shuffle signups using Fisher-Yates
    const shuffled = [...signups];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // Remove any existing contracts for this contract type in this season before auto-assigning
    const existing = await req.em.find(Contract, {season: season.id, contractType: contractType.id});
    for (const c of existing) {
        req.em.remove(c);
    }

    const createdContracts: Contract[] = [];
    for (let i = 0; i < shuffled.length; i++) {
        const contractor = shuffled[i].user;
        const contractee = shuffled[(i + 1) % shuffled.length].user;

        const contract = req.em.create(Contract, {
            season: season.id,
            contractType: contractType,
            contractor: contractor,
            contractee: contractee,
            name: "",
            progress: "",
            score: "",
            reviewContent: "",
            verdict: "PENDING",
        });
        createdContracts.push(contract);
    }

    await req.em.flush();
    res.json({success: true, count: createdContracts.length, contracts: createdContracts});
});

router.patch("/seasons/:id/contracts/:contractId/assign", writeRateLimiter, requireAuth, async (req, res) => {
    const season = await Season.getSeasonById(req.em, req.params.id as string);
    if (season === null) throw new APIError(404, "Season not found");
    if (season.completed) throw new APIError(400, "Cannot assign contract on a completed season");

    const contract = await req.em.findOne(Contract, {id: req.params.contractId as string}, {populate: ["contractType", "contractor"]});
    if (contract === null || contract.season !== season.id) throw new APIError(404, "Contract not found");

    const userRoles = req.auth!.roles.getItems();
    const isAdmin = userRoles.some(x => x.role === "admin");

    if (!isAdmin && contract.contractor.id !== req.auth!.id) {
        throw new APIError(403, "Not your contract to assign");
    }

    if (!isAdmin) {
        if (contract.contractType.assignmentStart > new Date()) {
            throw new APIError(400, "Assignment period has not started yet");
        }
        if (contract.contractType.assignmentEnd < new Date()) {
            throw new APIError(400, "Assignment period has ended");
        }
    }

    const result = parseModelPatch(req.body, ContractSchema, {include: ["name"], partial: false});
    Object.assign(contract, result);
    await req.em.flush();
    res.json({success: true, contract});
});

router.patch("/seasons/:id/contracts/:contractId/review", writeRateLimiter, requireAuth, async (req, res) => {
    const season = await Season.getSeasonById(req.em, req.params.id as string);
    if (season === null) throw new APIError(404, "Season not found");
    const contract = await req.em.findOne(Contract, {id: req.params.contractId as string}, {populate: ["contractType"]});
    if (contract === null || contract.season !== season.id) throw new APIError(404, "Contract not found");
    if (contract.verdict !== "PENDING") throw new APIError(403, "Contract has already been graded");
    if (contract.contractee.id !== req.auth!.id) throw new APIError(403, "Not your contract");
    if (contract.contractType.reviewDeadline < new Date()) throw new APIError(403, "Review deadline has passed");
    const result = parseModelPatch(req.body, ContractSchema, {include: ["progress", "score", "reviewContent"], partial: true});
    Object.assign(contract, result);
    await req.em.flush();
    res.json({success: true, contract});
});

router.patch("/seasons/:id/contracts/:contractId/verdict", writeRateLimiter, requireAllRoles(["admin"]), async (req, res) => {
    const season = await Season.getSeasonById(req.em, req.params.id as string);
    if (season === null) throw new APIError(404, "Season not found");
    if (season.completed) throw new APIError(403, "Cannot change verdict of a completed season");
    const contract = await req.em.findOne(Contract, {id: req.params.contractId as string}, {populate: ["contractType"]});
    if (contract === null || contract.season !== season.id) throw new APIError(404, "Contract not found");
    const result = parseModelPatch(req.body, ContractSchema, {include: ["verdict"], partial: false});
    Object.assign(contract, result);
    await req.em.flush();
    res.json({success: true, contract});
});
export default router;