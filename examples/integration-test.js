#!/usr/bin/env node

const { execFileSync }= require('child_process');
const assert = require('assert');

function get_lint_results(filename) {
    let cmd_args = ['-f', 'json', filename];
    let lint_results = [];
    try {
        let results = execFileSync('eslint', cmd_args, {encoding: 'utf8', stdio: 'pipe'})
        lint_results = JSON.parse(results)
    }
    catch (e) {
        if (e.status !== 1 && e.status !== 0) {
            console.error("The lint command itself failed", e.status);
            throw e;
        }
        lint_results = JSON.parse(e.stdout)
    }
    return lint_results
}

function sum_by_rule_id(lint_results) {
    error_count_by_rule_id = {}
    warning_count_by_rule_id = {}
    for (file_result of lint_results) {
        for (message of file_result.messages) {
            let counter = error_count_by_rule_id;
            if (message.severity === 1)  {
                counter = warning_count_by_rule_id;
            }
            if (counter[message.ruleId]) {
                counter[message.ruleId]++;
            }
            else {
                counter[message.ruleId] = 1;
            }
        }
    }
    return {"errors": error_count_by_rule_id, "warnings": warning_count_by_rule_id};
} 

// counts is an object mapping ruleIds to counts
// expected_array is al ist of expected ruleIds (can have repeated ruleIds)
function match_count_by_expectation(counts, expected_array) {
    for (rule_id of expected_array) {
        assert(counts[rule_id], `${rule_id} violation not found`);
        counts[rule_id]--;
    }
    for (rule_id in counts) {
        assert(counts[rule_id] == 0, `${rule_id} had an unexpected occurence`);
    }
}

function validate_file_by_rules(filename, expected_errors=[], expected_warnings=[]) {
    lint_results = get_lint_results(filename);
    counts_by_rule_id = sum_by_rule_id(lint_results)

    error_counts = counts_by_rule_id.errors
    match_count_by_expectation(error_counts, expected_errors)
    warning_counts = counts_by_rule_id.warnings
    match_count_by_expectation(warning_counts, expected_warnings)
}

function validate_files_by_totals(filename, error_totals, warning_totals) {
    lint_results = get_lint_results(filename);
    lint_result = lint_results[0]
    assert(lint_result.errorCount === error_totals,
        `${filename} has unexpected number of errors`);
    assert(lint_result.warningCount === warning_totals,
        `${filename} has unexpected number of warnings`);
}

validate_file_by_rules('samples/good-json.json', [], []);
validate_file_by_rules('samples/duplicate-keys.json',
    ['json/duplicate-key', 'json/duplicate-key'], [])
validate_file_by_rules('samples/whole-mess.json',
    ['json/duplicate-key', 'json/duplicate-key', 'json/trailing-comma'],
    ['json/*']);
validate_file_by_rules('samples/json-with-comments.json', [], [])

validate_files_by_totals('samples/wrong-syntax.json', 0, 1)