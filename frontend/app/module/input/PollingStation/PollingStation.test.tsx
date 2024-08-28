import { createMemoryRouter } from "react-router-dom";

import { render as rtlRender } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, test } from "vitest";

import { routes } from "app/routes";
import { Providers, screen, userTypeInputs, waitFor } from "app/test/unit";

import { electionMockData } from "@kiesraad/api-mocks";

const router = createMemoryRouter(routes, {
  future: {
    v7_normalizeFormMethod: true,
  },
});

const render = () => rtlRender(<Providers router={router} />);

const user = userEvent.setup();

async function submit() {
  await user.click(screen.getByRole("button", { name: "Volgende" }));
}

const startPollingStationInput = async () => {
  await router.navigate("/1/input/1");
  expect(router.state.location.pathname).toEqual("/1/input/1");
};

const expectRecountedForm = async () => {
  await waitFor(() => {
    expect(screen.getByTestId("recounted_form")).toBeInTheDocument();
  });
};

const fillRecountedForm = async () => {
  await user.click(screen.getByLabelText("Nee, er was geen hertelling"));
};

const expectVotersAndVotesForm = async () => {
  await waitFor(() => {
    expect(screen.getByTestId("voters_and_votes_form")).toBeInTheDocument();
  });
};

const fillVotersAndVotesForm = async (values?: Record<string, number>) => {
  const total_votes = electionMockData.political_groups.length * 10;

  const userValues = values ?? {
    poll_card_count: total_votes,
    proxy_certificate_count: 0,
    voter_card_count: 0,
    total_admitted_voters_count: total_votes,
    votes_candidates_counts: total_votes,
    blank_votes_count: 0,
    invalid_votes_count: 0,
    total_votes_cast_count: total_votes,
  };

  await userTypeInputs(user, userValues);
};

const expectDifferencesForm = async () => {
  await waitFor(() => {
    expect(screen.getByTestId("differences_form")).toBeInTheDocument();
  });
};

const fillDifferencesForm = async () => {
  await userTypeInputs(user, {
    more_ballots_count: 0,
    fewer_ballots_count: 0,
    unreturned_ballots_count: 0,
    too_few_ballots_handed_out_count: 0,
    too_many_ballots_handed_out_count: 0,
    other_explanation_count: 0,
    no_explanation_count: 0,
  });
};

const expectPoliticalGroupCandidatesForm = async (pgNumber: number) => {
  await waitFor(() => {
    expect(screen.getByTestId(`candidates_form_${pgNumber}`)).toBeInTheDocument();
  });
};

const fillPoliticalGroupCandidatesVotesForm = async () => {
  await userTypeInputs(user, {
    "candidate_votes[0].votes": 5,
    "candidate_votes[1].votes": 5,
    total: 10,
  });
};

const expectCheckAndSavePage = async () => {
  await waitFor(() => {
    expect(router.state.location.pathname).toEqual("/1/input/1/save");
  });
};

const expectFeedbackError = async (code?: string) => {
  await waitFor(() => {
    expect(screen.getByTestId("feedback-error")).toBeInTheDocument();
  });
  if (code) {
    expect(screen.getByText(code)).toBeInTheDocument();
  }
};

const expectFeedbackWarning = async (code?: string) => {
  await waitFor(() => {
    expect(screen.getByTestId("feedback-warning")).toBeInTheDocument();
  });
  if (code) {
    expect(screen.getByText(code)).toBeInTheDocument();
  }
};

const expectBlockerModal = async () => {
  await waitFor(() => {
    expect(screen.getByTestId("modal-blocker-title")).toBeInTheDocument();
  });
};

const expectElementContainsIcon = (id: string, ariaLabel: string) => {
  const el = screen.getByTestId(id);
  expect(el).toBeInTheDocument();
  expect(el).toContainHTML(`aria-label="${ariaLabel}"`);
};

describe("Polling Station data entry integration tests", () => {
  test("Navigate through complete form", async () => {
    render();

    const formFillingSteps = [
      startPollingStationInput,
      expectRecountedForm,
      fillRecountedForm,
      submit,
      expectVotersAndVotesForm,
      fillVotersAndVotesForm,
      submit,
      expectDifferencesForm,
      fillDifferencesForm,
      submit,
      ...electionMockData.political_groups.flatMap((pg) => [
        () => expectPoliticalGroupCandidatesForm(pg.number),
        fillPoliticalGroupCandidatesVotesForm,
        submit,
      ]),
      expectCheckAndSavePage,
    ];

    for (const step of formFillingSteps) {
      await step();
    }
  });

  test("Navigate back", async () => {
    render();

    const steps = [
      // fill up to and including the differences form
      startPollingStationInput,
      expectRecountedForm,
      fillRecountedForm,
      submit,
      expectVotersAndVotesForm,
      fillVotersAndVotesForm,
      submit,
      expectDifferencesForm,
      fillDifferencesForm,
      submit,
      // navigate back to the 'voters and votes' form
      () => userEvent.click(screen.getByRole("link", { name: "Aantal kiezers en stemmen" })),
      expectVotersAndVotesForm,
    ];

    for (const step of steps) {
      await step();
    }
  });

  test("Navigate back with dirty state", async () => {
    render();

    const steps = [
      // fill up to and including the voters and votes form
      startPollingStationInput,
      expectRecountedForm,
      fillRecountedForm,
      submit,
      expectVotersAndVotesForm,
      fillVotersAndVotesForm,
      // don't submit, and navigate back to the 'recounted' form
      () => userEvent.click(screen.getByRole("link", { name: "Is er herteld?" })),
      expectRecountedForm,
    ];

    for (const step of steps) {
      await step();
    }
  });

  test("Navigate to correct page after navigating back and submitting", async () => {
    render();

    const steps = [
      // fill up to and including the differences form
      startPollingStationInput,
      expectRecountedForm,
      fillRecountedForm,
      submit,
      expectVotersAndVotesForm,
      fillVotersAndVotesForm,
      submit,
      expectDifferencesForm,
      fillDifferencesForm,
      submit,
      // navigate back to the 'voters and votes' form and submit
      () => userEvent.click(screen.getByRole("link", { name: "Aantal kiezers en stemmen" })),
      expectVotersAndVotesForm,
      submit,
      // expect to be on the 'differences' form
      expectDifferencesForm,
    ];

    for (const step of steps) {
      await step();
    }
  });

  test("Navigate triggers changes modal", async () => {
    render();
    await startPollingStationInput();
    await expectRecountedForm();
    await fillRecountedForm();
    await submit();

    await expectVotersAndVotesForm();

    await fillVotersAndVotesForm();
    await submit();

    await expectDifferencesForm();

    await userEvent.click(screen.getByRole("link", { name: "Aantal kiezers en stemmen" }));

    await expectVotersAndVotesForm();

    await fillVotersAndVotesForm({
      poll_card_count: 1,
      proxy_certificate_count: 1,
      voter_card_count: 1,
      total_admitted_voters_count: 2,
      votes_candidates_counts: 1,
      blank_votes_count: 1,
      invalid_votes_count: 1,
      total_votes_cast_count: 3,
    });

    await submit();
    await expectFeedbackError();

    await fillVotersAndVotesForm({
      total_admitted_voters_count: 3,
    });

    await userEvent.click(screen.getByRole("link", { name: "Verschillen" }));

    await expectBlockerModal();
  });

  test("Progress list shows correct icons", async () => {
    render();

    const formFillingSteps = [
      startPollingStationInput,
      expectRecountedForm,
      fillRecountedForm,
      submit,
      expectVotersAndVotesForm,
      fillVotersAndVotesForm,
      submit,
      expectDifferencesForm,
      fillDifferencesForm,
      submit,
      ...electionMockData.political_groups.flatMap((pg) => [
        () => expectPoliticalGroupCandidatesForm(pg.number),
        fillPoliticalGroupCandidatesVotesForm,
        submit,
      ]),
      expectCheckAndSavePage,
    ];

    for (const step of formFillingSteps) {
      await step();
    }

    expectElementContainsIcon("list-item-recounted", "opgeslagen");
    expectElementContainsIcon("list-item-differences", "leeg");

    await userEvent.click(screen.getByRole("link", { name: "Verschillen" }));

    await expectDifferencesForm();

    await userTypeInputs(user, {
      more_ballots_count: 1,
      fewer_ballots_count: 1,
    });

    await submit();
    await expectFeedbackWarning();

    await user.click(screen.getByTestId("differences_form_ignore_warnings"));
    expect(screen.getByTestId("differences_form_ignore_warnings")).toBeChecked();

    await submit();

    await expectPoliticalGroupCandidatesForm(1);

    expectElementContainsIcon("list-item-differences", "bevat een waarschuwing");
  });
});
