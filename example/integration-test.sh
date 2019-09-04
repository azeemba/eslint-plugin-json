#!/bin/bash

count_file=$(mktemp)
echo 0 > $count_file
function increment_error_count() {
    local current_value=$(< $count_file)
    echo $((current_value + 1)) > $count_file
}
function s() {
    [ $1 -le 1 ]|| echo s
}

function lint_file() {
    local file=samples/$1.json
    if [ ! -f $file ]; then return 1; fi
    npm run lint -- $file 2> /dev/null
}
function check() {
    local type=$1
    local error_code=$2
    local expected_error_count=$3
    local actual_error_count=$(while read line; do echo "$line"; done| grep " $type "| grep $error_code | wc -l)
    if [ "$actual_error_count" -ne "$expected_error_count" ]; then
        echo "Expected $expected_error_count $error_code $type$(s $expected_error_count) but got $actual_error_count"
        increment_error_count
        return 1
    fi
}

lint_file duplicate-keys | check error "json/duplicate-key" 2
lint_file wrong-syntax | check warning "json/*" 1
lint_file whole-mess | check error "json/duplicate-key" 2
lint_file whole-mess | check error "json/trailing-comma" 1
lint_file whole-mess | check warning 'json/comment-not-permitted' 1
lint_file good-json | check warning "json/" 0
lint_file good-json | check warning "json/" 0

error_count=$(< $count_file)
echo
if [ "$error_count" -gt 0 ]; then
    echo "Integration test, in total $error_count error$(s $error_count) occured"
    exit 1;
else
    echo "All integrations tests passed! \\o/"
fi
