const { execSync } = require("child_process");

const POSTGRES_CONTAINER = "voice-sales-postgres";
const ADMINER_CONTAINER = "voice-sales-adminer";
const NETWORK = "voice-sales-net";
const POSTGRES_IMAGE = "pgvector/pgvector:pg16";
const ADMINER_IMAGE = "adminer:latest";
const POSTGRES_VOLUME = "voice_sales_postgres_data";
const POSTGRES_PORT = 5433;
const ADMINER_PORT = 8080;

let dockerPrefix = null;

function getDockerPrefix() {

    if (dockerPrefix)
        return dockerPrefix;

    try {

        execSync("docker --version", { stdio: "ignore" });
        dockerPrefix = "docker";
        return dockerPrefix;

    } catch (_) {}

    try {

        execSync("wsl docker --version", { stdio: "ignore" });
        dockerPrefix = "wsl docker";
        return dockerPrefix;

    } catch (_) {}

    throw new Error(
        "Docker not found. Start Docker in WSL with: sudo service docker start"
    );

}

function docker(command) {

    return `${getDockerPrefix()} ${command}`;

}

function run(command) {

    execSync(command, { stdio: "inherit", shell: true });

}

function runQuiet(command) {

    execSync(command, { stdio: "ignore", shell: true });

}

function sleep(ms) {

    return new Promise(resolve => setTimeout(resolve, ms));

}

function containerExists(name) {

    try {

        execSync(docker(`inspect ${name}`), {
            stdio: "ignore",
            shell: true
        });

        return true;

    } catch {

        return false;

    }

}

function ensureNetwork() {

    try {

        runQuiet(docker(`network inspect ${NETWORK}`));

    } catch {

        console.log(`Creating docker network '${NETWORK}'...`);
        run(docker(`network create ${NETWORK}`));

    }

}

async function waitForPostgres(maxAttempts = 30) {

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {

        try {

            execSync(
                docker(`exec ${POSTGRES_CONTAINER} pg_isready -U postgres -d voice_sales_agent`),
                { stdio: "ignore", shell: true }
            );

            console.log("PostgreSQL is ready.");
            return;

        } catch {

            console.log(`Waiting for PostgreSQL... (${attempt}/${maxAttempts})`);
            await sleep(1000);

        }

    }

    throw new Error("PostgreSQL did not become ready in time.");

}

function startPostgres() {

    ensureNetwork();

    if (containerExists(POSTGRES_CONTAINER)) {

        console.log(`Container '${POSTGRES_CONTAINER}' already exists. Starting it...`);
        run(docker(`start ${POSTGRES_CONTAINER}`));
        return;

    }

    run(docker([
        "run -d",
        `--name ${POSTGRES_CONTAINER}`,
        `--network ${NETWORK}`,
        "-e POSTGRES_USER=postgres",
        "-e POSTGRES_PASSWORD=postgres",
        "-e POSTGRES_DB=voice_sales_agent",
        `-p ${POSTGRES_PORT}:5432`,
        `-v ${POSTGRES_VOLUME}:/var/lib/postgresql/data`,
        POSTGRES_IMAGE
    ].join(" ")));

}

function startAdminer() {

    ensureNetwork();

    if (containerExists(ADMINER_CONTAINER)) {

        console.log(`Container '${ADMINER_CONTAINER}' already exists. Starting it...`);
        run(docker(`start ${ADMINER_CONTAINER}`));
        return;

    }

    run(docker([
        "run -d",
        `--name ${ADMINER_CONTAINER}`,
        `--network ${NETWORK}`,
        "-e ADMINER_DEFAULT_SERVER=voice-sales-postgres",
        `-p ${ADMINER_PORT}:8080`,
        ADMINER_IMAGE
    ].join(" ")));

}

async function up() {

    console.log("Starting PostgreSQL + pgvector + Adminer in Docker...\n");

    startPostgres();
    await waitForPostgres();
    startAdminer();

    console.log("");
    console.log("Database URL:");
    console.log(`postgresql://postgres:postgres@localhost:${POSTGRES_PORT}/voice_sales_agent`);
    console.log("");
    console.log("Browser UI:");
    console.log(`http://localhost:${ADMINER_PORT}`);
    console.log("");
    console.log("Adminer login:");
    console.log("  System   : PostgreSQL");
    console.log("  Server   : voice-sales-postgres");
    console.log("  Username : postgres");
    console.log("  Password : postgres");
    console.log("  Database : voice_sales_agent");

}

function stopContainer(name) {

    if (!containerExists(name)) {

        console.log(`Container '${name}' does not exist.`);
        return;

    }

    console.log(`Stopping '${name}'...`);
    run(docker(`stop ${name}`));

}

function removeContainer(name) {

    if (!containerExists(name)) {

        console.log(`Container '${name}' does not exist.`);
        return;

    }

    console.log(`Removing '${name}'...`);
    run(docker(`rm -f ${name}`));

}

function removeVolume() {

    try {

        console.log(`Removing volume '${POSTGRES_VOLUME}'...`);
        run(docker(`volume rm ${POSTGRES_VOLUME}`));

    } catch {

        console.log(`Volume '${POSTGRES_VOLUME}' not found.`);

    }

}

function down() {

    stopContainer(ADMINER_CONTAINER);
    stopContainer(POSTGRES_CONTAINER);

}

function remove() {

    removeContainer(ADMINER_CONTAINER);
    removeContainer(POSTGRES_CONTAINER);

}

async function reset() {

    console.log("Resetting PostgreSQL (this deletes all stored data)...\n");

    remove();
    removeVolume();
    await up();

    console.log("");
    console.log("Fresh database created with password: postgres");
    console.log("Next: npm run db:init && npm run embed");

}

const command = process.argv[2] || "up";

(async () => {

    if (command === "up")
        await up();
    else if (command === "down")
        down();
    else if (command === "remove")
        remove();
    else if (command === "reset")
        await reset();
    else
        throw new Error(`Unknown command: ${command}`);

})().catch(err => {

    console.error("\nDocker command failed:");
    console.error(err.message);
    process.exit(1);

});
