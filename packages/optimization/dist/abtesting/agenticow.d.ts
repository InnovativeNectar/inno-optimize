export declare class AgenticowClient {
    createBranch(branchPath: string, options: {
        label: string;
        basePath: string;
        dimension: number;
    }): Promise<void>;
    promoteBranch(branchPath: string, options: {
        basePath: string;
        requireClearance: boolean;
    }): Promise<void>;
    rollbackBranch(branchPath: string): Promise<void>;
    listBranches(): Promise<string[]>;
}
//# sourceMappingURL=agenticow.d.ts.map