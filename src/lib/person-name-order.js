import collectors from '../../teikas_json/collectors.json' with { type: 'json' };
import narrators from '../../teikas_json/narrators.json' with { type: 'json' };
import { formatPersonName } from './person-names.js';

const originalNames = new Map([...collectors, ...narrators].map(person => [formatPersonName(person.fullName), person.fullName]));

/** Accept either display names or original names (including old filter links). */
export const personSortName = (name) => originalNames.get(name) ?? name;
export const comparePersonNames = (first, second) => personSortName(first).localeCompare(personSortName(second), 'lv', { numeric: true });
