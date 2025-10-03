// Elasticsearch infrastructure exports
export {
  ElasticsearchConnection,
  initializeElasticsearch,
  elasticsearchConnection,
} from './connection';
export { BaseSearchService, SearchOptions, SearchResult } from './baseSearchService';
export type { ElasticsearchConfig } from './connection';
