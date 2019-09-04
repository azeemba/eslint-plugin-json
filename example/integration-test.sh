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
    local filename=${4:-'<input>'}
    local actual_error_count=$(while read line; do echo "$line"; done | grep " $type " | grep $error_code | wc -l)
    if [ "$actual_error_count" -ne "$expected_error_count" ]; then
        echo "Expected $expected_error_count $error_code $type$(s $expected_error_count) in $filename but got $actual_error_count"
        increment_error_count
        return 1
    fi
}
function check_file() {
    local file="$1" type="$2" error_name="$3" count="$4"
    lint_file "$file" | check "$type" "$error_name" "$count" "'$file'"
}

json=json
check_file good-json warning "$json/" 0
check_file good-json warning "$json/" 0
check_file duplicate-keys error "$json/duplicate-key" 2
check_file wrong-syntax warning "$json/*" 1
check_file whole-mess error "$json/duplicate-key" 2
check_file whole-mess error "$json/trailing-comma" 1
check_file whole-mess "*" "$json/comment-not-permitted" 0 # eslint now tell to allow comments

error_count=$(< $count_file)
echo
if [ "$error_count" -gt 0 ]; then
    echo "Integration test, in total $error_count error$(s $error_count) occured"
    exit 1;
else
    echo "All integrations tests passed! \\o/"
fi
