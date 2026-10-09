export class AgenticowClient {
    async createBranch(branchPath, options) {
        console.log(`Creating COW branch: ${branchPath} (${options.label})`);
    }
    async promoteBranch(branchPath, options) {
        console.log(`Promoting COW branch: ${branchPath} (clearance: ${options.requireClearance})`);
    }
    async rollbackBranch(branchPath) {
        console.log(`Rolling back COW branch: ${branchPath}`);
    }
    async listBranches() {
        return [];
    }
}
//# sourceMappingURL=agenticow.js.map