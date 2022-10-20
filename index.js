#!/usr/bin/env node

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = __importDefault(require("child_process"));
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const commander_1 = require("commander");
const webpack_1 = __importDefault(require("webpack"));
const cheerio_1 = __importDefault(require("cheerio"));
const plist_1 = __importDefault(require("plist"));
const NwBuilder = require('nw-builder');
const webpackConfigFn = require('./webpack.config');
const latestNwjsVersion = "0.69.1";
const getCurrentOs = function () {
    let platform = os_1.default.platform();
    if (platform === 'darwin') {
        return "mac";
    }
    if (platform === 'linux') {
        return 'linux';
    }
    return 'win';
};
const onTmpFolder = async function (callback) {
    let tmpDir;
    const appPrefix = 'electron-to-nwjs';
    try {
        tmpDir = fs_1.default.mkdtempSync(path_1.default.join(os_1.default.tmpdir(), appPrefix));
        await callback(tmpDir);
    }
    catch (e) {
        throw e;
    }
    finally {
        try {
            if (tmpDir) {
                //fs.rmdirSync(tmpDir, { recursive: true });
            }
        }
        catch (e) {
            console.error(`An error has occurred while removing the temp folder at ${tmpDir}. Please remove it manually. Error: ${e}`);
        }
    }
};
const asyncWebpack = (config) => {
    return new Promise((resolve, reject) => {
        (0, webpack_1.default)(config, (err, stats) => {
            if (err || stats.hasErrors()) {
                console.error(err);
                console.error(stats.toJson());
                return reject(err);
            }
            resolve(undefined);
        });
    });
};
const runPrebuildAndCreateNwjsProject = function (opts, callback) {
    const prebuildOutput = child_process_1.default.execSync("npm run nwjs:prebuild --if-present", { cwd: opts.projectDir, encoding: 'utf-8' });
    console.log(prebuildOutput);
    onTmpFolder(async function (tmpDir) {
        fs_extra_1.default.copySync(opts.projectDir, tmpDir);
        // So the electron node_module won't be compressed in the end, no matter what
        // That solves a building issue in Mac OS X 10.13 and lower
        fs_extra_1.default.rmdirSync(path_1.default.resolve(tmpDir, 'node_modules', 'electron'), { recursive: true });
        await asyncWebpack(webpackConfigFn({
            prod: opts.prod,
            main: true,
            projectPath: opts.projectDir,
            outputPath: tmpDir
        }));
        await asyncWebpack(webpackConfigFn({
            prod: opts.prod,
            main: false,
            projectPath: opts.projectDir,
            outputPath: tmpDir
        }));
        // Removing type="module" from <script> elements
        const listHtmlsStr = child_process_1.default.execSync('find . -type f -name "*.html"', { cwd: tmpDir, encoding: 'utf8' });
        const listHtmls = listHtmlsStr.split("\n").filter(line => line.trim().length > 0 && !line.includes("/node_modules/"));
        listHtmls.forEach(htmlPath => {
            let indexHtmlPath = path_1.default.join(tmpDir, htmlPath);
            let indexHtmlContents = fs_1.default.readFileSync(indexHtmlPath, { encoding: 'utf-8' });
            const $ = cheerio_1.default.load(indexHtmlContents);
            const scripts = $('script[type=module]');
            if (scripts.length > 0) {
                scripts.removeAttr('type');
                indexHtmlContents = $.html();
                fs_1.default.writeFileSync(indexHtmlPath, indexHtmlContents, { encoding: 'utf-8' });
            }
        });
        callback(tmpDir);
    })
        .catch(e => console.error(e));
};
const loadPackageJsonFromFolder = function (folder) {
    const projectPackagePath = path_1.default.resolve(folder, 'package.json');
    let projectPackageStr = fs_1.default.readFileSync(projectPackagePath, { encoding: 'utf-8' });
    return JSON.parse(projectPackageStr);
};
const listNodeModulesThatShouldntBeKept = function (projectDir) {
    let nodeModulesFolder = path_1.default.resolve(projectDir, 'node_modules');
    let packageJson = loadPackageJsonFromFolder(projectDir);
    let rootDependencies = Object.keys(packageJson.dependencies);
    let neededDependencies = [];
    const getAllDependenciesFromModule = function (module) {
        let moduleFolder = path_1.default.resolve(nodeModulesFolder, module);
        let moduleJson = loadPackageJsonFromFolder(moduleFolder);
        let moduleDependencies = Object.keys(moduleJson.dependencies);
        let allDependencies = moduleDependencies.concat([]);
        moduleDependencies.forEach(dep => {
            allDependencies.push(...getAllDependenciesFromModule(dep));
        });
        return allDependencies;
    };
    rootDependencies.forEach(dep => {
        neededDependencies.push(dep);
        let moduleFolder = path_1.default.resolve(nodeModulesFolder, dep);
        loadPackageJsonFromFolder(moduleFolder);
    });
    neededDependencies = neededDependencies.filter((v, i, a) => a.indexOf(v) === i);
    let allDependencies = fs_1.default.readdirSync(nodeModulesFolder);
    let removableDependencies = allDependencies.filter((v, i) => neededDependencies.indexOf(v) === -1);
    return removableDependencies;
};
const buildNwjsBuilderConfig = function (projectPath, os) {
    const projectPackagePath = path_1.default.resolve(projectPath, 'package.json');
    let projectPackageStr = fs_1.default.readFileSync(projectPackagePath, { encoding: 'utf-8' });
    const projectPackageJson = JSON.parse(projectPackageStr);
    const nwjs = projectPackageJson.nwjs || {};
    // Mixed-context can't be used, otherwise the ipc methods won't work
    let flags = [
        "--enable-logging=stderr",
        nwjs["chromium-args"] || ""
    ];
    projectPackageJson["chromium-args"] = flags.join(" ");
    projectPackageJson["node-remote"] = nwjs["node-remote"];
    projectPackageStr = JSON.stringify(projectPackageJson, null, 2);
    fs_1.default.writeFileSync(projectPackagePath, projectPackageStr, { encoding: 'utf-8' });
    let build = (projectPackageJson.build || {});
    let authorName = (projectPackageJson.author || {}).name || "Unknown";
    let nwjsConfig = {
        appName: (build[os] || {}).productName || build.productName || projectPackageJson.name || "Unknown",
        appVersion: projectPackageJson.version,
        company: authorName,
        copyright: (build[os] || {}).copyright || build.copyright || `Copyright © ${new Date().getFullYear()} ${authorName}. All rights reserved`,
        files: (build[os] || {}).files || build.files || ["**/**"],
        icon: (build[os] || {}).icon
    };
    if (nwjsConfig.icon) {
        nwjsConfig.icon = path_1.default.join(projectPath, nwjsConfig.icon);
    }
    if (!nwjsConfig.files.includes("**/**")) {
        nwjsConfig.files.unshift("**/**");
    }
    nwjsConfig.files.push("!.git");
    let removableDependencies = listNodeModulesThatShouldntBeKept(projectPath);
    removableDependencies.forEach(dep => {
        nwjsConfig.files.push(`!node_modules/${dep}/**`);
    });
    nwjsConfig.files = nwjsConfig.files.map((file) => {
        if (file.endsWith("/*"))
            file = file + "*/**";
        const ignorable = file.startsWith("!");
        if (ignorable)
            file = file.substring(1);
        return (ignorable ? "!" : "") + path_1.default.join(projectPath, file);
    });
    if (os === "mac") {
        const entitlementsFilename = build[os].entitlements;
        if (entitlementsFilename) {
            const entitlementsPath = path_1.default.join(projectPath, entitlementsFilename);
            const entitlementsStr = fs_1.default.readFileSync(entitlementsPath, { encoding: 'utf-8' });
            const entitlements = plist_1.default.parse(entitlementsStr);
            nwjsConfig.macPlist = entitlements;
        }
    }
    return nwjsConfig;
};
const program = new commander_1.Command();
program
    .command('start <dir>')
    .description('start an Electron project with NW.js')
    .action((dir) => {
    const projectDir = path_1.default.resolve('.', dir);
    runPrebuildAndCreateNwjsProject({ projectDir, prod: false }, (tmpDir) => {
        const config = buildNwjsBuilderConfig(tmpDir, getCurrentOs());
        var nw = new NwBuilder({
            appName: config.appName,
            appVersion: config.appVersion,
            files: config.files,
            version: latestNwjsVersion
        });
        nw.on('log', console.log);
        nw.on("stdout", (out) => {
            console.log(Buffer.isBuffer(out) ? out.toString() : out);
        });
        nw.on("stderr", (out) => {
            console.error(Buffer.isBuffer(out) ? out.toString() : out);
        });
        nw.run().then(function () {
            console.info("App started");
        })
            .catch(function (error) {
            console.error("App failed to start");
            console.error(error);
        });
    });
});
program
    .command('build')
    .description('build an Electron project with NW.js')
    .option('--projectDir, --project <dir>', 'The path to project directory. Defaults to current working directory.', '.')
    .option('-m, -o, --mac, --macos', 'Build for macOS')
    .option('-l, --linux', 'Build for Linux')
    .option('-w, --windows, --win', 'Build for Windows')
    .option('-v, --nwjs-version <version>', 'NW.js version', latestNwjsVersion)
    .option('--x86', 'Build for x86')
    .action(function () {
    const opts = this.opts();
    const projectDir = path_1.default.resolve('.', opts.project);
    runPrebuildAndCreateNwjsProject({ projectDir, prod: true }, (tmpDir) => {
        const platforms = ["mac", "linux", "win"].filter(s => opts[s]);
        if (platforms.length === 0) {
            platforms.push(getCurrentOs());
        }
        platforms.forEach(platform => {
            const config = buildNwjsBuilderConfig(tmpDir, platform);
            let nwjsPlatform = platform;
            if (nwjsPlatform === "mac") {
                nwjsPlatform = "osx";
            }
            var nw = new NwBuilder({
                files: config.files,
                version: opts.nwjsVersion,
                flavor: 'normal',
                platforms: [nwjsPlatform + (opts.x86 ? "32" : "")],
                appName: config.appName,
                appVersion: config.appVersion,
                buildDir: path_1.default.resolve(projectDir, './nwjs_dist'),
                // macCredits (path to your credits.html)
                macIcns: config.icon,
                macPlist: config.macPlist,
                winVersionString: {
                    'CompanyName': config.company,
                    'FileDescription': config.appName,
                    'ProductName': config.appName,
                    'LegalCopyright': config.copyright
                },
                winIco: config.icon,
                useRcedit: true
            });
            nw.on('log', console.log);
            nw.build().then(function () {
                const postDistOutput = child_process_1.default.execSync("npm run nwjs:postdist --if-present", { cwd: projectDir });
                console.log(postDistOutput);
            })
                .catch(function (error) {
                console.error(error);
            });
        });
    });
});
program.parse(process.argv);
