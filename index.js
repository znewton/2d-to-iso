import fs from "node:fs/promises";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import chalk from "chalk";

const inputArg = process.argv[2];
const outputArg = process.argv[3];
const optionsArg = process.argv[4];

/**
 * @typedef {Object} ConvertToIsometricOptions
 * @property {boolean} verbose
 */

/**
 * @type {ConvertToIsometricOptions}
 */
const options = optionsArg ? JSON.parse(optionsArg) : { verbose: false };

const log = options.verbose ? console.log : () => {};
const warn = options.verbose ? console.warn : () => {};
const error = options.verbose ? console.error : () => {};

const execP = promisify(exec);
/**
 * Run a command and output stdout and in
 * @param {string} cmd
 * @returns {Promise<string>}
 * @throws {string}
 */
async function cli(cmd) {
    const { stdout, stderr } = await execP(cmd);
    if (stderr) {
        throw new Error(stderr);
    }
    return stdout;
}

/**
 * Check if value is within acceptable margin.
 * @param {number} value - Value to check
 * @param {number} target - Target to check value against
 * @param {number} margin - Plus/Minus margin value should be within as a percentage of target (e.g. 1 would be +/- 1% from target)
 * @returns {boolean}
 */
function withinMargin(value, target, margin) {
    const plusminus = Math.round((target * margin) / 100);
    return value < target + plusminus && value > target - plusminus;
}

/**
 * @typedef {Object} Dimensions
 * @property {number} width
 * @property {number} height
 */

/**
 *
 * @param {string|import("node:fs").PathLike} imgPath
 * @returns {Promise<Dimensions>}
 */
async function getImageDimensions(imgPath) {
    const identifyResult = await cli(
        `gm identify -verbose ${imgPath} | grep Geometry`,
    );
    const identifyJson = parseYaml(identifyResult);
    const [width, height] = identifyJson.Geometry.split("x");
    return {
        width: Number.parseInt(width),
        height: Number.parseInt(height),
    };
}

/**
 * Convert a 2D image to 30deg isometric view.
 * @param {string|import("node:fs").PathLike} inputPath
 * @param {string|import("node:fs").PathLike} outputPath
 * @returns {Promise<void>}
 */
async function convertToIsometric(inputPath, outputPath) {
    if (!(await fs.stat(inputPath)).isFile()) {
        error(`${inputPath} does not exist`);
        throw new Error("Cannot convert image that does not exist");
    }

    log(`Converting ${inputPath} to isometric at ${outputPath}`);

    const { width, height } = await getImageDimensions(inputPath);

    // True Isometric is a 30deg angle <> square
    const shearAngle = 30;
    const targetWidth = Math.round((width * 2) / 3);
    // y_shear is measured relative to the X axis
    const yShear = Math.round(
        Math.tan((shearAngle * Math.PI) / 180) * targetWidth,
    );
    // So the amount we want to yShear will need to translate to a specific angle relative to Y
    const targetHeight = height + yShear;

    log(`Conversion Dimensions -
Original Size: ${width}x${height}
Target Width: ${targetWidth}
Target Height: ${targetHeight}
`);

    await fs.copyFile(inputPath, outputPath);
    await cli(`gm mogrify -geometry ${targetWidth}x${height}! ${outputPath}`);
    await cli(
        // Trial and Error showed that 35deg is actually what produces a 30deg right triangle below asset.
        `gm mogrify -shear 0x${
            shearAngle + 5
        } -background "transparent" ${outputPath}`,
    );

    const { width: final_width, height: final_height } =
        await getImageDimensions(outputPath);
    log(`Final Identify Result -
Dimensions: ${final_width}x${final_height}
`);

    if (
        withinMargin(final_width, targetWidth, 0.5) &&
        withinMargin(final_height, targetHeight, 0.5)
    ) {
        console.log(`${chalk.bold.greenBright("Success!")} - ${outputPath}`);
    } else {
        console.warn(
            `${chalk.bold.yellowBright("Outside Margin!")} - ${outputPath}`,
        );
        warn("Final dimensions are not within 0.5% of target dimensions.");
    }
}

/**
 * Run the application.
 * @returns {Promise<void>}
 */
async function main() {
    const input = path.resolve(inputArg);
    const output = path.resolve(outputArg);

    const inputStat = await fs.stat(input);
    if (inputStat.isFile()) {
        convertToIsometric(input, output);
    } else if (inputStat.isDirectory()) {
        const outputStat = await fs.stat(output).catch((error) => {
            if (error?.code === "ENOENT") return undefined;
            throw error;
        });
        if (outputStat?.isFile()) {
            throw new Error(
                "Invalid Output: Cannot write to file as directory.",
            );
        }
        if (!outputStat?.isDirectory()) {
            await fs.mkdir(output, { recursive: true });
        }
        const files = await fs.readdir(input, { recursive: false });
        /**
         * @type {Promise<void>[]}
         */
        const conversionPs = [];
        files.forEach((fileName) => {
            conversionPs.push(
                convertToIsometric(
                    path.join(input, fileName),
                    path.join(output, fileName),
                ),
            );
        });
        await Promise.allSettled(conversionPs);
    } else {
        throw new Error(
            "Invalid Input: Input path was not a file or directory.",
        );
    }
}

main().catch((error) => {
    console.error(chalk.bold.red("Failed!"));
    console.error(error);
});
