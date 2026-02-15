{ pkgs, lib, config, inputs, ... }:

{
  # https://devenv.sh/packages/
  packages = [];

  # https://devenv.sh/languages/
  languages.javascript.enable = true;
  languages.javascript.npm.enable = true;

  # https://devenv.sh/scripts/
  scripts.lint-all.exec = ''
    prek run --all-files
  '';
  scripts.cc-edit-lint-hook.exec = ''
    "$DEVENV_ROOT/scripts/cc-edit-lint-hook.mjs"
  '';

  # https://devenv.sh/git-hooks/
  git-hooks.hooks.npx-eslint = {
    enable = true;
    entry = "npx eslint --cache --fix";
    files = "^.*\.[cm]?(js|ts)x?$";
  };
  git-hooks.hooks.actionlint = {
    enable = true;
    entry = "actionlint";
    files = "^.github/workflows/.*\.ya?ml$";
  };

  # See full reference at https://devenv.sh/reference/options/
}
