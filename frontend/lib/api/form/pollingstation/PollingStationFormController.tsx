import * as React from "react";

import {
  ApiResponseErrorData,
  DataEntryResponse,
  Election,
  PollingStationResults,
  usePollingStationDataEntry,
  ValidationResult,
} from "@kiesraad/api";
import { rootFieldSection } from "@kiesraad/util";

export interface PollingStationFormControllerProps {
  election: Required<Election>;
  pollingStationId: number;
  entryNumber: number;
  children: React.ReactNode;
}

//TODO: change getValues so it also works for political_group_votes, getValues should only return the form for the specific list to use in caching.
export interface FormReference<T> {
  type: string;
  id: FormSectionID;
  getValues: () => T;
}

export interface FormReferenceVotersAndVotes
  extends FormReference<Pick<PollingStationResults, "voters_counts" | "votes_counts">> {
  type: "voters_and_votes";
}

export interface FormReferenceDifferences
  extends FormReference<PollingStationResults["differences_counts"]> {
  type: "differences";
}

export interface FormReferencePoliticalGroupVotes
  extends FormReference<PollingStationResults["political_group_votes"][0]> {
  type: "political_group_votes";
  number: number;
}

export type AnyFormReference =
  | FormReferenceVotersAndVotes
  | FormReferenceDifferences
  | FormReferencePoliticalGroupVotes;

export interface iPollingStationControllerContext {
  loading: boolean;
  error: ApiResponseErrorData | null;
  data: DataEntryResponse | null;
  formState: FormState;
  targetFormSection: FormSectionID;
  values: PollingStationResults;
  setValues: React.Dispatch<React.SetStateAction<PollingStationResults>>;
  setTemporaryCache: (cache: AnyCache | null) => boolean;
  cache: AnyCache | null;
  currentForm: AnyFormReference | null;
  submitCurrentForm: (ignoreWarnings?: boolean) => void;
  registerCurrentForm: (form: AnyFormReference) => void;
}

export type FormSectionID =
  | "voters_votes_counts"
  | "differences_counts"
  | `political_group_votes_${number}`;

export type FormSection = {
  id: FormSectionID;
  isSaved: boolean;
  ignoreWarnings: boolean;
  errors: ValidationResult[];
  warnings: ValidationResult[];
};

export interface FormState {
  current: FormSectionID; //the current step that needs completion
  active: FormSectionID; //the form that is currently active
  sections: Record<FormSectionID, FormSection>;
  unknown: {
    errors: ValidationResult[];
    warnings: ValidationResult[];
  };
}

//store unvalidated data
export type TemporaryCache<T> = {
  key: string;
  data: T;
  id?: number;
};

export interface TemporaryCacheVotersAndVotes
  extends TemporaryCache<Pick<PollingStationResults, "voters_counts" | "votes_counts">> {
  key: "voters_and_votes";
}

export interface TemporaryCachePoliticalGroupVotes
  extends TemporaryCache<PollingStationResults["political_group_votes"][0]> {
  key: "political_group_votes";
}

export interface TemporaryCacheDifferences
  extends TemporaryCache<PollingStationResults["differences_counts"]> {
  key: "differences";
}

export type AnyCache =
  | TemporaryCacheVotersAndVotes
  | TemporaryCachePoliticalGroupVotes
  | TemporaryCacheDifferences;

export const PollingStationControllerContext = React.createContext<
  iPollingStationControllerContext | undefined
>(undefined);

export function PollingStationFormController({
  election,
  pollingStationId,
  entryNumber,
  children,
}: PollingStationFormControllerProps) {
  const [doRequest, { data, loading, error }] = usePollingStationDataEntry({
    polling_station_id: pollingStationId,
    entry_number: entryNumber,
  });

  const temporaryCache = React.useRef<AnyCache | null>(null);

  //reference to the current form on screen
  const currentForm = React.useRef<AnyFormReference | null>(null);

  // consumable flag to ignore warnings for the active form section;
  const _ignoreWarnings = React.useRef<FormSectionID | null>(null);

  //where to navigate to next
  const [targetFormSection, setTargetFormSection] =
    React.useState<FormSectionID>("voters_votes_counts");

  const [formState, setFormState] = React.useState<FormState>(() => {
    const result: FormState = {
      active: "voters_votes_counts",
      current: "voters_votes_counts",
      sections: {
        voters_votes_counts: {
          id: "voters_votes_counts",
          isSaved: false,
          ignoreWarnings: false,
          errors: [],
          warnings: [],
        },
        differences_counts: {
          id: "differences_counts",
          isSaved: false,
          ignoreWarnings: false,
          errors: [],
          warnings: [],
        },
      },
      unknown: {
        errors: [],
        warnings: [],
      },
    };

    election.political_groups.forEach((pg) => {
      result.sections[`political_group_votes_${pg.number}`] = {
        id: `political_group_votes_${pg.number}`,
        isSaved: false,
        ignoreWarnings: false,
        errors: [],
        warnings: [],
      };
    });

    return result;
  });

  const [values, _setValues] = React.useState<PollingStationResults>(() => ({
    political_group_votes: election.political_groups.map((pg) => ({
      number: pg.number,
      total: 0,
      candidate_votes: pg.candidates.map((c) => ({
        number: c.number,
        votes: 0,
      })),
    })),
    differences_counts: {
      more_ballots_count: 0,
      fewer_ballots_count: 0,
      unreturned_ballots_count: 0,
      too_few_ballots_handed_out_count: 0,
      too_many_ballots_handed_out_count: 0,
      other_explanation_count: 0,
      no_explanation_count: 0,
    },
    voters_counts: {
      proxy_certificate_count: 0,
      total_admitted_voters_count: 0,
      voter_card_count: 0,
      poll_card_count: 0,
    },
    votes_counts: {
      blank_votes_count: 0,
      invalid_votes_count: 0,
      total_votes_cast_count: 0,
      votes_candidates_counts: 0,
    },
  }));

  const _isCalled = React.useRef<boolean>(false);

  const setValues = React.useCallback((values: React.SetStateAction<PollingStationResults>) => {
    _isCalled.current = true;
    _setValues((old) => {
      const newValues = typeof values === "function" ? values(old) : values;
      return {
        ...old,
        ...newValues,
      };
    });
  }, []);

  const setTemporaryCache = React.useCallback((cache: AnyCache | null) => {
    //OPTIONAL: allow only cache for unvalidated data
    temporaryCache.current = cache;
    return true;
  }, []);

  React.useEffect(() => {
    if (data) {
      //Form state changes based of validation results in data.
      setFormState((old) => {
        const newFormState = { ...old };
        //reset all errors/warnings, the server validates the entire request each time.
        resetErrorsAndWarnings(newFormState);
        //distribute errors to sections
        addValidationResultToFormState(newFormState, data.validation_results.errors, "errors");
        //distribute warnings to sections
        addValidationResultToFormState(newFormState, data.validation_results.warnings, "warnings");

        //what form section is active
        const activeFormSection = newFormState.sections[newFormState.active];
        if (activeFormSection) {
          //store that this section has been sent to the server
          activeFormSection.isSaved = true;

          //flag ignore warnings
          activeFormSection.ignoreWarnings = _ignoreWarnings.current === activeFormSection.id;

          //determine new current if applicable
          if (newFormState.current === activeFormSection.id) {
            if (activeFormSection.errors.length === 0) {
              if (activeFormSection.warnings.length === 0 || activeFormSection.ignoreWarnings) {
                const nextSectionID = getNextSection(newFormState, activeFormSection.id);
                if (nextSectionID) {
                  newFormState.current = nextSectionID;
                } else {
                  console.log("FORM FINISHED?");
                }
              }
            }
          }
        }
        return newFormState;
      });
      //clean up
    }
  }, [data]);

  //tell the "outside world" which form section to show next
  React.useEffect(() => {
    const activeSection = formState.sections[formState.active];
    if (activeSection) {
      if (formSectionComplete(activeSection)) {
        setTargetFormSection(formState.current);
      }
    }
  }, [formState]);

  const registerCurrentForm = React.useCallback(
    (form: AnyFormReference) => {
      if (currentForm.current === null || form.id !== currentForm.current.id) {
        currentForm.current = form;
        if (form.id !== formState.active) {
          setFormState((old) => {
            const newFormState = { ...old };
            newFormState.active = form.id;
            return newFormState;
          });
        }
      }
    },
    [currentForm, formState],
  );

  const submitCurrentForm = React.useCallback(
    (ignoreWarnings?: boolean) => {
      if (currentForm.current) {
        const ref: AnyFormReference = currentForm.current;

        //flag this submit to ignore warnings
        _ignoreWarnings.current = ignoreWarnings ? ref.id : null;

        switch (ref.type) {
          case "political_group_votes":
            setValues((old) => ({
              ...old,
              political_group_votes: old.political_group_votes.map((pg) => {
                if (pg.number === ref.number) {
                  return ref.getValues();
                }
                return pg;
              }),
            }));
            break;
          case "voters_and_votes":
          case "differences":
          default:
            setValues((old) => ({
              ...old,
              ...ref.getValues(),
            }));
            break;
        }
      }
    },
    [setValues, currentForm],
  );

  React.useEffect(() => {
    if (_isCalled.current) {
      doRequest({
        data: values,
      });
    }
  }, [doRequest, values]);

  return (
    <PollingStationControllerContext.Provider
      value={{
        formState,
        values,
        setValues,
        loading,
        error,
        data,
        cache: temporaryCache.current,
        setTemporaryCache,
        currentForm: currentForm.current,
        registerCurrentForm,
        submitCurrentForm,
        targetFormSection,
      }}
    >
      {children}
    </PollingStationControllerContext.Provider>
  );
}

function addValidationResultToFormState(
  formState: FormState,
  arr: ValidationResult[],
  target: "errors" | "warnings",
) {
  arr.forEach((validationResult) => {
    const { name: rootSection, index } = rootFieldSection(validationResult.fields[0]);
    switch (rootSection) {
      case "votes_counts":
      case "voters_counts":
        formState.sections.voters_votes_counts[target].push(validationResult);
        break;
      case "differences_counts":
        formState.sections.differences_counts[target].push(validationResult);
        break;
      case "political_group_votes":
        if (index !== undefined) {
          const sectionKey = `political_group_votes_${index}` as FormSectionID;
          const section = formState.sections[sectionKey];
          if (section) {
            section[target].push(validationResult);
          }
        }
        break;
      default:
        formState.unknown[target].push(validationResult);
        break;
    }
  });
}

function formSectionComplete(section: FormSection): boolean {
  if (section.isSaved) {
    if (section.errors.length === 0) {
      if (section.warnings.length === 0 || section.ignoreWarnings) {
        return true;
      }
    }
  }
  return false;
}

function getNextSection(formState: FormState, currentSection: FormSectionID): FormSectionID | null {
  const keys = Object.keys(formState.sections);
  const currentIndex = keys.indexOf(currentSection);
  if (currentIndex !== -1) {
    if (currentIndex + 1 < keys.length) {
      return keys[currentIndex + 1] as FormSectionID;
    }
  }
  return null;
}

function resetErrorsAndWarnings(formState: FormState) {
  Object.values(formState.sections).forEach((section) => {
    section.errors = [];
    section.warnings = [];
  });
  formState.unknown.errors = [];
  formState.unknown.warnings = [];
}
