export interface BusinessDomain {
    id: string;
    name: string;
    description: string;
    departments: string[];
    keyMetrics: string[];
    commonWorkflows: string[];
}
export declare class BusinessDomainRegistry {
    private domains;
    register(domain: BusinessDomain): void;
    get(id: string): BusinessDomain | undefined;
    list(): BusinessDomain[];
    getByDepartment(department: string): BusinessDomain[];
}
export declare const STANDARD_DOMAINS: BusinessDomain[];
//# sourceMappingURL=business-domain.d.ts.map