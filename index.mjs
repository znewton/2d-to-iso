import fs from "node:fs/promises";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import chalk from "chalk";

const execP = promisify(exec);
/**
 * Run a command and output stdout and in
 * @param {string} cmd 
 * @returns {Promise<string>}
 * @throws {string}
 */
async function cli(cmd) {
    const {stdout, stderr} = await execP(cmd);
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
    const plusminus = Math.round(target * margin / 100);
    return value < (target + plusminus) && value > (target - plusminus);
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
        `gm identify -verbose ${imgPath} | grep Geometry`
    );
    const identifyJson = parseYaml(identifyResult);
    const [width, height] = identifyJson.Geometry.split("x");
    return {
        width: Number.parseInt(width),
        height: Number.parseInt(height),
    };
}

/**
 * Run the application.
 * @returns {Promise<void>}
 */
async function main() {
    const inputImg = path.resolve(process.argv[2]);
    const outputImg = path.resolve(process.argv[3]);

    if (!(await fs.stat(inputImg)).isFile) {
        console.error(`${inputImg} does not exist`);
        throw new Error("Cannot convert image that does not exist");
    }

    console.log(`Converting -
Input: ${inputImg}
Output: ${outputImg}
`);

    const {width,height} = await getImageDimensions(inputImg);

    // True Isometric is a 30deg angle <> square
    const shearAngle = 30;
    const targetWidth = Math.round(width*2/3);
    // y_shear is measured relative to the X axis
    const yShear = Math.round(Math.tan(shearAngle * Math.PI / 180)*targetWidth);
    // So the amount we want to yShear will need to translate to a specific angle relative to Y
    const targetHeight = height + yShear;

    console.log(`Conversion Dimensions -
Original Size: ${width}x${height}
Target Width: ${targetWidth}
Target Height: ${targetHeight}
`);

    await fs.copyFile(inputImg, outputImg);
    await cli(
        `gm mogrify -geometry ${targetWidth}x${height}! ${outputImg}`
    );
    await cli(
        // Trial and Error showed that 35deg is actually what produces a 30deg right triangle below asset.
        `gm mogrify -shear 0x${shearAngle+5} -background "transparent" ${outputImg}`
    );

    const {width:final_width,height:final_height} = await getImageDimensions(outputImg);
    console.log(`Final Identify Result -
Dimensions: ${final_width}x${final_height}
`);

    if (withinMargin(final_width, targetWidth, 0.5) && withinMargin(final_height, targetHeight, 0.5)) {
        console.log(chalk.bold.greenBright("Success!"));
    } else {
        console.warn(chalk.bold.yellowBright("Warning!"));
        console.warn("Final dimensions are not within 0.5% of target dimensions.");
    }
}

main().catch((error) => {
    console.error(chalk.bold.red("Failed!"));
    console.error(error);
});