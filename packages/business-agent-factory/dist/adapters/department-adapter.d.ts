export interface DepartmentConfig {
    name: string;
    tools: string[];
    templates: string[];
    memorySettings: {
        workingMemorySize: number;
        episodicRetentionDays: number;
    };
}
export declare class DepartmentAdapter {
    private configs;
    register(config: DepartmentConfig): void;
    get(name: string): DepartmentConfig | undefined;
    getTools(department: string): string[];
    getTemplates(department: string): string[];
    getMemorySettings(department: string): {
        workingMemorySize: number;
        episodicRetentionDays: number;
    };
    listDepartments(): string[];
}
export declare const DEFAULT_DEPARTMENTS: DepartmentConfig[];
//# sourceMappingURL=department-adapter.d.ts.map