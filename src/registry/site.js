// Site-wide settings. Labels read `launch` and the day windows: a component added after launch is "New" for
// `newForDays` days from its `added` date; one with an `updated` date is "Updated" for `updatedForDays`.
export const site = {
  name: 'AwardComponents',
  description: 'The home of the awards plugin for Claude Code and Codex: its docs, the sites it built and judged, and award-league components with live controls and a prompt that rebuilds each one in your project.',
  repo: 'https://github.com/BurgiSimon/AwardComponents',
  awards: {
    repo: 'https://github.com/BurgiSimon/awards',
    recipesPath: 'https://github.com/BurgiSimon/awards/tree/main/plugins/awards/recipes',
    install: {
      claude: ['/plugin marketplace add burgisimon/awards', '/plugin install awards@awards'],
      codex: ['codex plugin marketplace add burgisimon/awards', 'codex plugin add awards@awards'],
    },
  },
  launch: '2026-10-28',
  newForDays: 45,
  updatedForDays: 30,
};
