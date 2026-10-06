export class TemplateManager {
    templates = new Map();
    register(template) {
        this.templates.set(template.id, template);
    }
    get(id) {
        return this.templates.get(id);
    }
    list() {
        return Array.from(this.templates.values());
    }
    listByDomain(domain) {
        return Array.from(this.templates.values()).filter(t => t.domain === domain);
    }
    listByDepartment(department) {
        return Array.from(this.templates.values()).filter(t => t.department === department);
    }
}
//# sourceMappingURL=manager.js.map