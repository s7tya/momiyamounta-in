import { type MemoryStream, Stream } from "xstream";
import { ReactSource, h, makeComponent } from "@cycle/react";
import type { ReactElement } from "react";

type Cookie = { label: string; sel: symbol };
const COOKIES: Cookie[] = [];

function cookieCheckboxList(cookieList: Cookie[], state: boolean[]) {
  return cookieList.map((cookie, i) =>
    h("div", [
      h("label", [
        cookie.label,
        h("input", { type: "checkbox", sel: cookie.sel, checked: state[i] }),
      ]),
    ])
  );
}

function main(sources: {
  react: ReactSource;
  persistentDialog: Stream<boolean>;
}) {
  const cookies$ = Stream.merge(
    ...COOKIES.map((cookie, i) =>
      sources.react.select(cookie.sel).events("change").mapTo(i)
    )
  );
  const hideButtonSel = Symbol();
  const hide$ = sources.react.select(hideButtonSel).events("click");
  const visibility$ = Stream.merge(
    sources.persistentDialog,
    hide$.mapTo(false)
  );

  visibility$.setDebugListener({
    next(d) {
      console.log(d);
    },
  });
  const state$ = cookies$.fold((state, index) => {
    const newState = [...state];
    newState[index] = !state[index];
    return newState;
  }, new Array<boolean>(COOKIES.length).fill(false));

  const vdom$: MemoryStream<ReactElement> = Stream.combine(
    state$,
    visibility$
  ).map(([state, isVisible]) =>
    h(
      "dialog",
      {
        open: isVisible,
        style: { position: "fixed", bottom: 0, width: "100%" },
      },
      [
        h(
          "div",
          {
            style: {
              display: "flex",
              flexDirection: "column",
              paddingBlock: "0.5rem",
              gap: "0.5rem",
              maxWidth: "40rem",
              marginInline: "auto",
            },
          },
          [
            h("p", "このサイトではいくつかのCookieを利用しています。"),
            h("fieldset", [
              h("div", [
                `許可したCookie ${state.reduce(
                  (acc, s) => acc + Number(s),
                  0
                )} / ${COOKIES.length}`,
              ]),
              ...cookieCheckboxList(COOKIES, state),
            ]),

            h(
              "button",
              {
                type: "button",
                sel: hideButtonSel,
                style: { backgroundColor: "red" },
              },
              [
                state.every((c) => c)
                  ? "すべてのCookieを受け入れる"
                  : "一部のCookieを拒否する",
              ]
            ),
          ]
        ),
      ]
    )
  );
  vdom$.setDebugListener({
    next(v) {
      console.log(v);
    },
  });

  return {
    react: vdom$,
    persistentDialog: hide$,
  };
}

export const Bannar = makeComponent(main as any, {
  persistentDialog: (sinks) => {
    sinks.addListener({
      next() {
        localStorage.setItem("showCookieDialog", "false");
      },
    });
    return Stream.create({
      start: (listener) => {
        // なんかqueueMicrotaskを挟むと動く、Stream.ofだと同期的だからか動かない。非同期なんもわからんモミ~
        queueMicrotask(() =>
          listener.next(localStorage.getItem("showCookieDialog") !== "false")
        );
      },
      stop: () => { },
    });
  },
});
