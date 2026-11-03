import { documentationIssues, guidance, sources, topics } from '../resources/v2/knowledge.js';
import type { DocumentationIssue, Guidance, Source, Topic } from '../resources/v2/knowledge.js';
import { sandbox } from '../resources/v2/environment.js';

export class DocumentationService {
  constructor(
    private readonly content: Partial<Record<Topic, Guidance>> = guidance,
    private readonly references: Record<string, Source> = sources,
    private readonly issues: DocumentationIssue[] = documentationIssues,
  ) {}
  referencesFor(ids: string[]): Source[] {
    return ids.flatMap((id) => (this.references[id] ? [this.references[id]] : []));
  }
  get(topic: Topic, apiVersion = '2.0.0') {
    const entry = this.content[topic];
    if (apiVersion !== '2.0.0' || !entry || entry.sourceIds.some((id) => !this.references[id])) {
      return {
        status: 'unavailable' as const,
        apiVersion,
        topic,
        message:
          'Verified documentation is unavailable for this version/topic or a required citation is missing.',
      };
    }
    return {
      status: 'available' as const,
      apiVersion,
      topic,
      environment: sandbox,
      requirements: entry.requirements,
      recommendations: entry.recommendations,
      sources: this.referencesFor(entry.sourceIds),
      conflicts: this.issues
        .filter((issue) => topic === 'overview' || issue.topics.includes(topic))
        .map((issue) => ({ ...issue, sources: this.referencesFor(issue.sourceIds) })),
      availableTopics: topics,
    };
  }
}
