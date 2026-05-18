import {defineEntity, p} from "@mikro-orm/core";
import {User} from "@/helpers/models/user";
import {sqlSet} from "@/helpers/db-common";
import {Season} from "@/helpers/models/season/season";

// these values came from the google form
const PC_POWER = ["HIGH", "MID", "LOW", "POTATO"] as const;
const XBOX_GAME_PASS = ["CONSOLE", "PC", "ULTIMATE", "NONE"] as const;
const GAME_GENRES = [
    "PLATFORMERS",
    "PUZZLES",
    "WESTERN_RPGS",
    "JRPGS",
    "CRPGS",
    "ARPGS",
    "ACTION_ADVENTURE",
    "ROGUELIKE",
    "STRATEGY",
    "SIMULATION",
    "VISUAL_NOVEL",
    "FIGHTING",
    "RACING",
    "SHOOTERS",
    "RHYTHM",
    "CASUAL",
    "METROIDVANIA",
    "BULLET_HELL",
    "BULLET_HEAVEN",
    "DATING",
    "ROGUELIKE_DECKBUILDERS",
] as const;
const CHALLENGE_LEVELS = ["EASY", "MEDIUM", "HARD", "VERY_HARD", "SURPRISE_ME"] as const;
const GAME_LENGTHS = ["SHORT", "AVERAGE", "LONG", "ANYTHING"] as const;

export const SignUpFormSchema = defineEntity({
    name: "SignUpForm",
    properties: {
        id: p.bigint().primary(),
        user: () => p.manyToOne(User).mapToPk().joinColumn("user").referenceColumnName("id"),

        // basic info
        // the server you represent, e.g. Frieren
        repServer: p.string().default(""),
        // link to the user's anilist/mal; better to split into (type, username)?
        anilistUrl: p.string().default(""),
        // preferred/accepting medium
        preferredMedium: p.string().default(""),
        acceptingMedium: p.string().default(""),
        // preferred/banned genre
        preferredGenres: p.string().default(""),
        bannedGenres: p.string().default(""),

        // specials
        extremeSpecialParticipation: p.boolean().default(false),
        sponsorParticipation: p.boolean().default(false),
        aidParadeParticipation: p.boolean().default(false),

        // video games related
        // steam/playstation/xbox
        gameProfileUrl: p.string().nullable(),
        // high/mid/low-end/potato
        pcPower: p.enum(PC_POWER).nullable(),
        hasXboxGamePass: p.enum(XBOX_GAME_PASS).nullable(),
        preferredGameGenres: p.enum(GAME_GENRES).array().columnType(sqlSet(GAME_GENRES)).nullable(),
        // easy/medium/hard/very hard/surprise me
        challengeLevelPreference: p.enum(CHALLENGE_LEVELS).nullable(),
        // short/average/long/anything
        gameLengthPreference: p.enum(GAME_LENGTHS).nullable(),

        // extras
        competitiveBlitzParticipation: p.boolean().default(false),
        casualBlitzParticipation: p.boolean().default(false),
        bookClubParticipation: p.boolean().default(false),
        gameClubParticipation: p.boolean().default(false),

        // final remarks
        notesForStaff: p.string().default(""),
        notesForContractor: p.string().default(""),

        createdAt: p.datetime().onCreate(() => new Date()),
        updatedAt: p.datetime().onCreate(() => new Date()).onUpdate(() => new Date()),
    },
});

export class SignupForm extends SignUpFormSchema.class {}

SignUpFormSchema.setClass(SignupForm);

export const SignUpSchema = defineEntity({
    name: "SignUp",
    properties: {
        user: () => p.manyToOne(User).joinColumn("user").referenceColumnName("id").primary(),
        season: p.manyToOne(Season).mapToPk().joinColumn("season").referenceColumnName("id").primary(),

        createdAt: p.datetime().onCreate(() => new Date()),
        updatedAt: p.datetime().onCreate(() => new Date()).onUpdate(() => new Date()),
    },
});