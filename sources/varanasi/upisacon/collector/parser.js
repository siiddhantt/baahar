function upisaconParserText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function upisaconParserTag(node) {
  return String(node?.tagName ?? node?.name ?? "").toLowerCase();
}

function upisaconParserRequireTag(node, tagName, label) {
  if (upisaconParserTag(node) !== tagName) {
    throw new Error(`UPISACON ${label} changed element type`);
  }
}

const upisaconParserHeadings = $("h2")
  .toArray()
  .filter(
    (node) => upisaconParserText($(node).text()) === "Pre-Conference Workshops",
  );
if (upisaconParserHeadings.length !== 1) {
  throw new Error("UPISACON workshop heading must be unique");
}

const upisaconParserHeading = upisaconParserHeadings[0];
const upisaconParserContainer = $(upisaconParserHeading).parent();
if (upisaconParserContainer.length !== 1) {
  throw new Error("UPISACON workshop container must be unique");
}

const upisaconParserParts = upisaconParserContainer.children().toArray();
if (upisaconParserParts.length !== 4) {
  throw new Error("UPISACON workshop section topology changed");
}
upisaconParserRequireTag(upisaconParserParts[0], "h2", "heading");
upisaconParserRequireTag(upisaconParserParts[1], "p", "date and venue");
upisaconParserRequireTag(upisaconParserParts[2], "div", "workshop grid");
upisaconParserRequireTag(upisaconParserParts[3], "div", "registration rules");

const upisaconParserCards = $(upisaconParserParts[2]).children().toArray();
if (upisaconParserCards.length !== 7) {
  throw new Error("UPISACON workshop card count changed");
}

const upisaconParserCardFacts = upisaconParserCards.map((card, index) => {
  upisaconParserRequireTag(card, "div", `workshop card ${index + 1}`);
  const children = $(card).children().toArray();
  if (children.length !== 4) {
    throw new Error(`UPISACON workshop card ${index + 1} topology changed`);
  }
  const labels = children.filter((node) => upisaconParserTag(node) === "span");
  const titles = children.filter((node) => upisaconParserTag(node) === "h4");
  const descriptions = children.filter(
    (node) => upisaconParserTag(node) === "p",
  );
  if (labels.length !== 1 || titles.length !== 1 || descriptions.length !== 1) {
    throw new Error(`UPISACON workshop card ${index + 1} fields changed`);
  }
  return {
    label: upisaconParserText($(labels[0]).text()),
    title: upisaconParserText($(titles[0]).text()),
  };
});

const upisaconParserRuleNodes = $(upisaconParserParts[3]).children().toArray();
if (
  upisaconParserRuleNodes.length !== 3 ||
  upisaconParserRuleNodes.some((node) => upisaconParserTag(node) !== "p")
) {
  throw new Error("UPISACON registration rule topology changed");
}

const upisaconParserRegistrationLinks = $("a")
  .toArray()
  .map((node) => ({
    text: upisaconParserText($(node).text()),
    href: upisaconParserText($(node).attr("href")),
  }))
  .filter(
    (link) =>
      link.href === "https://registration.upisaconvaranasi2026.com/user/login",
  );

return {
  heading: upisaconParserText($(upisaconParserParts[0]).text()),
  subtitle: upisaconParserText($(upisaconParserParts[1]).text()),
  cards: upisaconParserCardFacts,
  rules: upisaconParserRuleNodes.map((node) =>
    upisaconParserText($(node).text()),
  ),
  registration_links: upisaconParserRegistrationLinks,
};
