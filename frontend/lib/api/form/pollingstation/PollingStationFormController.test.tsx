import * as React from "react";

import { describe, expect, test } from "vitest";

import { renderHook, waitFor } from "app/test/unit";

import { electionDetailMock } from "@kiesraad/api-mocks";

import { ApiProvider } from "../../ApiProvider";
import { PollingStationFormController } from "./PollingStationFormController";
import { usePollingStationFormController } from "./usePollingStationFormController";

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <ApiProvider host="http://testhost">
    <PollingStationFormController
      election={electionDetailMock}
      pollingStationId={1}
      entryNumber={1}
    >
      {children}
    </PollingStationFormController>
  </ApiProvider>
);

describe("PollingStationFormController", () => {
  test("PollingStationFormController renderHook", async () => {
    const { result, rerender } = renderHook(() => usePollingStationFormController(), {
      wrapper: Wrapper,
    });

    result.current.registerCurrentForm({
      id: "recounted",
      type: "recounted",
      getValues: () => {
        return {
          recounted: true,
        };
      },
    });

    expect(result.current.values.recounted).toEqual(false);

    rerender();

    result.current.submitCurrentForm();

    rerender();
    expect(result.current.values.recounted).toEqual(true);

    await waitFor(() => {
      expect(result.current.formState.current).toBe("voters_votes_counts");
    });

    result.current.registerCurrentForm({
      id: "voters_votes_counts",
      type: "voters_and_votes",
      getValues: () => {
        return {
          voters_counts: {
            proxy_certificate_count: 1,
            total_admitted_voters_count: 2,
            voter_card_count: 1,
            poll_card_count: 1,
          },
          votes_counts: {
            blank_votes_count: 0,
            invalid_votes_count: 0,
            total_votes_cast_count: 0,
            votes_candidates_counts: 0,
          },
        };
      },
    });

    result.current.submitCurrentForm();

    await waitFor(() => {
      expect(result.current.formState.sections.voters_votes_counts.errors.length).toBe(1);
    });

    expect(result.current.values.voters_counts.proxy_certificate_count).toEqual(1);
  });
});
