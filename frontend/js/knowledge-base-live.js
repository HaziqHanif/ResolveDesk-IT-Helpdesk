(function () {

    "use strict";


    let currentUser =
        null;

    let apiCategories =
        [];

    let liveStats =
        {};

    let liveToastTimer =
        null;


    /* =========================================================
       HELPERS
    ========================================================= */

    function get(
        id
    ) {

        return document.getElementById(
            id
        );
    }


    function escapeLiveHtml(
        value
    ) {

        return String(
            value ?? ""
        )
            .replaceAll(
                "&",
                "&amp;"
            )
            .replaceAll(
                "<",
                "&lt;"
            )
            .replaceAll(
                ">",
                "&gt;"
            )
            .replaceAll(
                '"',
                "&quot;"
            )
            .replaceAll(
                "'",
                "&#039;"
            );
    }


    function categoryKey(
        name
    ) {

        const value =
            String(
                name ||
                ""
            )
                .trim()
                .toLowerCase();


        if (
            value.includes(
                "network"
            )
        ) {

            return "network";
        }


        if (
            value.includes(
                "software"
            )
        ) {

            return "software";
        }


        if (
            value.includes(
                "hardware"
            )
        ) {

            return "hardware";
        }


        if (
            value.includes(
                "access"
            )
        ) {

            return "access";
        }


        if (
            value.includes(
                "email"
            )
        ) {

            return "email";
        }


        if (
            value.includes(
                "security"
            )
        ) {

            return "security";
        }


        return value
            .replace(
                /[^a-z0-9]+/g,
                "-"
            )
            .replace(
                /^-+|-+$/g,
                ""
            );
    }


    function formatUpdated(
        value
    ) {

        if (
            !value
        ) {

            return "Recently";
        }


        const date =
            new Date(
                value
            );


        if (
            Number.isNaN(
                date.getTime()
            )
        ) {

            return "Recently";
        }


        const difference =
            Date.now() -
            date.getTime();


        const minutes =
            Math.max(
                0,
                Math.floor(
                    difference /
                    60000
                )
            );


        if (
            minutes < 1
        ) {

            return "Just now";
        }


        if (
            minutes < 60
        ) {

            return `${
                minutes
            } min ago`;
        }


        const hours =
            Math.floor(
                minutes /
                60
            );


        if (
            hours < 24
        ) {

            return `${
                hours
            }h ago`;
        }


        const days =
            Math.floor(
                hours /
                24
            );


        if (
            days < 30
        ) {

            return `${
                days
            }d ago`;
        }


        return date
            .toLocaleDateString(
                "en-MY",
                {
                    day:
                        "2-digit",

                    month:
                        "short",

                    year:
                        "numeric"
                }
            );
    }


    /* =========================================================
       API
    ========================================================= */

    async function api(
        url,
        options = {}
    ) {

        const response =
            await fetch(
                url,
                {
                    credentials:
                        "include",

                    ...options,

                    headers: {

                        ...(options.body
                            ? {
                                "Content-Type":
                                    "application/json"
                            }
                            : {}),

                        ...(options.headers ||
                            {})

                    }
                }
            );


        const data =
            await response
                .json()
                .catch(
                    () => ({})
                );


        if (
            response.status ===
            401
        ) {

            location.replace(
                "/login.html"
            );


            throw new Error(
                "Login required."
            );
        }


        if (
            !response.ok
        ) {

            throw new Error(
                data.message ||
                "Request failed."
            );
        }


        return data;
    }


    /* =========================================================
       USER
    ========================================================= */

    async function loadUser() {

        const data =
            await api(
                "/api/auth/me"
            );


        if (
            !data.loggedIn ||
            !data.user
        ) {

            location.replace(
                "/login.html"
            );

            return;
        }


        currentUser =
            data.user;


        const name =
            currentUser.fullName ||
            currentUser.name ||
            currentUser.email ||
            "ResolveDesk User";


        const nameElement =
            document.querySelector(
                ".profile-copy strong"
            );


        const roleElement =
            document.querySelector(
                ".profile-copy span"
            );


        const avatar =
            document.querySelector(
                ".profile .avatar"
            );


        if (
            nameElement
        ) {

            nameElement.textContent =
                name;
        }


        if (
            roleElement
        ) {

            roleElement.textContent =
                currentUser.role ===
                    "ADMIN"
                    ? "Administrator"
                    : currentUser.role ===
                        "TECHNICIAN"
                        ? "Technician"
                        : "Staff";
        }


        if (
            avatar
        ) {

            avatar.textContent =
                String(
                    name
                )
                    .split(/\s+/)
                    .filter(Boolean)
                    .slice(0, 2)
                    .map(
                        word =>
                            word[0]
                    )
                    .join("")
                    .toUpperCase();
        }


        const createButton =
            get(
                "createArticleButton"
            );


        if (
            createButton &&
            currentUser.role !==
                "ADMIN"
        ) {

            createButton.style.display =
                "none";
        }
    }


    /* =========================================================
       LOAD DATA
    ========================================================= */

    async function loadKnowledge() {

        const data =
            await api(
                "/api/knowledge-base"
            );


        apiCategories =
            Array.isArray(
                data.categories
            )
                ? data.categories
                : [];


        liveStats =
            data.stats ||
            {};


        /*
            The original HTML declares:

                let articles = [...]

            We replace that demo array.
        */

        articles =
            (
                data.articles ||
                []
            )
                .map(
                    item => ({

                        id:
                            item.id,

                        title:
                            item.title,

                        category:
                            categoryKey(
                                item.category
                            ),

                        categoryName:
                            item.category,

                        categoryId:
                            item.categoryId,

                        summary:
                            item.summary,

                        content:
                            item.content,

                        author:
                            item.author,

                        visibility:
                            item.visibility,

                        views:
                            Number(
                                item.views
                            ) ||
                            0,

                        helpfulYes:
                            Number(
                                item.helpfulYes
                            ) ||
                            0,

                        helpfulNo:
                            Number(
                                item.helpfulNo
                            ) ||
                            0,

                        updated:
                            formatUpdated(
                                item.updatedAt
                            ),

                        updatedAt:
                            item.updatedAt

                    })
                );


        populateCategorySelect();

        updateRealStats();

        renderLive();


        console.log(
            "✅ Knowledge Base:",
            articles
        );
    }


    /* =========================================================
       CATEGORY SELECT
    ========================================================= */

    function populateCategorySelect() {

        const select =
            get(
                "articleCategory"
            );


        if (!select) {
            return;
        }


        const selected =
            select.value;


        select.innerHTML =
            apiCategories
                .map(
                    category => `

                        <option
                            value="${escapeLiveHtml(
                                category.id
                            )}"
                        >
                            ${escapeLiveHtml(
                                category.name
                            )}
                        </option>
                    `
                )
                .join("");


        if (
            [
                ...select.options
            ]
                .some(
                    option =>
                        option.value ===
                        selected
                )
        ) {

            select.value =
                selected;
        }
    }


    /* =========================================================
       STATS
    ========================================================= */

    function updateRealStats() {

        if (
            get(
                "articleCount"
            )
        ) {

            get(
                "articleCount"
            ).textContent =
                liveStats.articles ??
                articles.length;
        }


        if (
            get(
                "viewCount"
            )
        ) {

            get(
                "viewCount"
            ).textContent =
                liveStats.totalViews ??
                0;
        }


        const statCards =
            [
                ...document.querySelectorAll(
                    ".stats .stat"
                )
            ];


        /*
            Category count
        */

        if (
            statCards[1]
        ) {

            const strong =
                statCards[1]
                    .querySelector(
                        "strong"
                    );


            if (
                strong
            ) {

                strong.textContent =
                    liveStats.categories ??
                    apiCategories.length;
            }
        }


        /*
            Existing card says
            "Views This Month".

            DB only stores cumulative views,
            so label it correctly.
        */

        if (
            statCards[2]
        ) {

            const small =
                statCards[2]
                    .querySelector(
                        "small"
                    );


            if (
                small
            ) {

                small.textContent =
                    "Total Views";
            }


            const span =
                statCards[2]
                    .querySelector(
                        "span"
                    );


            if (
                span
            ) {

                span.textContent =
                    "All article opens";
            }
        }


        /*
            Replace fake self-service rate
            with measured feedback rate.
        */

        if (
            statCards[3]
        ) {

            const small =
                statCards[3]
                    .querySelector(
                        "small"
                    );


            const strong =
                statCards[3]
                    .querySelector(
                        "strong"
                    );


            const span =
                statCards[3]
                    .querySelector(
                        "span"
                    );


            if (
                small
            ) {

                small.textContent =
                    "Helpful Rate";
            }


            if (
                strong
            ) {

                strong.textContent =
                    liveStats.helpfulRate ===
                        null ||
                    liveStats.helpfulRate ===
                        undefined
                        ? "—"
                        : `${
                            liveStats.helpfulRate
                        }%`;
            }


            if (
                span
            ) {

                span.textContent =
                    "Positive reader feedback";
            }
        }


        const systemHealth =
            document.querySelector(
                ".sidebar-bottom .system-card strong"
            );


        if (
            systemHealth
        ) {

            systemHealth.textContent =
                `${
                    liveStats.articles ??
                    articles.length
                } published articles`;
        }


        /*
            Popular Articles currently says
            "Most viewed this month".

            We only have cumulative counters.
        */

        [
            ...document.querySelectorAll(
                ".panel"
            )
        ]
            .forEach(
                panel => {

                    const title =
                        panel
                            .querySelector(
                                ".panel-title strong"
                            )
                            ?.textContent
                            ?.trim();


                    if (
                        title ===
                        "Popular Articles"
                    ) {

                        const subtitle =
                            panel.querySelector(
                                ".panel-title span"
                            );


                        if (
                            subtitle
                        ) {

                            subtitle.textContent =
                                "Most viewed articles";
                        }
                    }
                }
            );
    }


    /* =========================================================
       RENDER USING EXISTING DESIGN
    ========================================================= */

    function renderLive() {

        if (
            typeof renderArticles ===
            "function"
        ) {

            renderArticles();
        }


        if (
            typeof renderPopular ===
            "function"
        ) {

            renderPopular();
        }


        if (
            typeof updateCategoryCounts ===
            "function"
        ) {

            updateCategoryCounts();
        }


        updateRealStats();
    }


    /* =========================================================
       CREATE ARTICLE
    ========================================================= */

    function visibilityValue() {

        const text =
            get(
                "articleVisibility"
            )
                ?.selectedOptions[
                    0
                ]
                ?.textContent
                ?.trim() ||
            "All Staff";


        if (
            text ===
            "Technicians Only"
        ) {

            return "TECHNICIANS_ONLY";
        }


        if (
            text ===
            "Administrators Only"
        ) {

            return "ADMINISTRATORS_ONLY";
        }


        return "ALL_STAFF";
    }


    get(
        "articleForm"
    )?.addEventListener(
        "submit",
        async event => {

            event.preventDefault();

            /*
                Stops the old DEMO submit
                handler from inserting into
                the local array.
            */

            event.stopImmediatePropagation();


            if (
                currentUser?.role !==
                "ADMIN"
            ) {

                showLiveToast(
                    "Administrator access required."
                );

                return;
            }


            const title =
                get(
                    "articleTitle"
                )?.value.trim();


            const summary =
                get(
                    "articleSummary"
                )?.value.trim();


            const content =
                get(
                    "articleContent"
                )?.value.trim();


            const categoryId =
                get(
                    "articleCategory"
                )?.value;


            if (
                !title ||
                !summary ||
                !content
            ) {

                showLiveToast(
                    "Complete the article before publishing."
                );

                return;
            }


            try {

                await api(
                    "/api/knowledge-base",
                    {

                        method:
                            "POST",

                        body:
                            JSON.stringify({

                                title,

                                summary,

                                content,

                                categoryId:
                                    categoryId
                                        ? Number(
                                            categoryId
                                        )
                                        : null,

                                visibility:
                                    visibilityValue()

                            })

                    }
                );


                get(
                    "articleForm"
                )?.reset();


                if (
                    typeof closeCreateModal ===
                    "function"
                ) {

                    closeCreateModal();

                } else {

                    get(
                        "createModal"
                    )?.classList
                    .remove(
                        "open"
                    );
                }


                selectedCategory =
                    "";


                document
                    .querySelectorAll(
                        ".category-button"
                    )
                    .forEach(
                        button =>
                            button.classList
                                .toggle(
                                    "active",
                                    !button.dataset
                                        .category
                                )
                    );


                await loadKnowledge();


                showLiveToast(
                    "Knowledge article published."
                );

            } catch (
                error
            ) {

                showLiveToast(
                    error.message
                );
            }

        },
        true
    );


    /* =========================================================
       REAL ARTICLE VIEW
    ========================================================= */

    window.openArticle =
        async function (
            id
        ) {

            try {

                const data =
                    await api(
                        `/api/knowledge-base/${
                            encodeURIComponent(
                                id
                            )
                        }`
                    );


                const article =
                    data.article;


                if (!article) {

                    throw new Error(
                        "Article not found."
                    );
                }


                /*
                    Sync incremented view
                    into existing array.
                */

                const existing =
                    articles.find(
                        item =>
                            String(
                                item.id
                            ) ===
                            String(
                                id
                            )
                    );


                if (
                    existing
                ) {

                    existing.views =
                        Number(
                            article.views
                        ) ||
                        existing.views;
                }


                const container =
                    get(
                        "articleView"
                    );


                if (!container) {
                    return;
                }


                container.innerHTML = `

                    <div class="article-view-category">
                        ${escapeLiveHtml(
                            article.category ||
                            "Uncategorised"
                        )}
                    </div>


                    <h2>
                        ${escapeLiveHtml(
                            article.title
                        )}
                    </h2>


                    <div class="article-view-meta">

                        <span>
                            Author:
                            ${escapeLiveHtml(
                                article.author
                            )}
                        </span>

                        <span>
                            Updated:
                            ${escapeLiveHtml(
                                formatUpdated(
                                    article.updatedAt
                                )
                            )}
                        </span>

                        <span>
                            ${
                                Number(
                                    article.views
                                ) ||
                                0
                            } views
                        </span>

                    </div>


                    <div class="article-view-content">${
                        escapeLiveHtml(
                            article.content
                        )
                    }</div>


                    <div class="article-view-footer">

                        <span>
                            Was this article helpful?
                        </span>


                        <div class="helpful-buttons">

                            <button
                                type="button"
                                class="
                                    helpful-button
                                    kb-helpful
                                "
                                data-id="${escapeLiveHtml(
                                    article.id
                                )}"
                                data-helpful="true"
                            >
                                Yes
                            </button>


                            <button
                                type="button"
                                class="
                                    helpful-button
                                    kb-helpful
                                "
                                data-id="${escapeLiveHtml(
                                    article.id
                                )}"
                                data-helpful="false"
                            >
                                No
                            </button>

                        </div>

                    </div>
                `;


                const modal =
                    get(
                        "viewModal"
                    );


                modal?.classList
                    .add(
                        "open"
                    );


                document.body.style
                    .overflow =
                    "hidden";


                renderLive();

            } catch (
                error
            ) {

                showLiveToast(
                    error.message
                );
            }
        };


    /* =========================================================
       HELPFUL
    ========================================================= */

    document.addEventListener(
        "click",
        async event => {

            const button =
                event.target.closest(
                    ".kb-helpful"
                );


            if (!button) {
                return;
            }


            const id =
                button.dataset.id;


            const helpful =
                button.dataset
                    .helpful ===
                "true";


            button.disabled =
                true;


            try {

                await api(
                    `/api/knowledge-base/${
                        encodeURIComponent(
                            id
                        )
                    }/helpful`,
                    {

                        method:
                            "POST",

                        body:
                            JSON.stringify({

                                helpful

                            })

                    }
                );


                await loadKnowledge();


                showLiveToast(
                    helpful
                        ? "Thanks for your feedback."
                        : "Feedback recorded."
                );


                document
                    .querySelectorAll(
                        ".kb-helpful"
                    )
                    .forEach(
                        item =>
                            item.disabled =
                                true
                    );

            } catch (
                error
            ) {

                button.disabled =
                    false;


                showLiveToast(
                    error.message
                );
            }
        }
    );


    /* =========================================================
       CATEGORY BUTTONS

       Stop old demo handler, but keep
       original renderer/styles.
    ========================================================= */

    document
        .querySelectorAll(
            ".category-button"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    event => {

                        event.preventDefault();

                        event.stopImmediatePropagation();


                        document
                            .querySelectorAll(
                                ".category-button"
                            )
                            .forEach(
                                item =>
                                    item.classList
                                        .remove(
                                            "active"
                                        )
                            );


                        button.classList
                            .add(
                                "active"
                            );


                        selectedCategory =
                            button.dataset
                                .category ||
                            "";


                        renderArticles();

                    },
                    true
                );
            }
        );


    /* =========================================================
       SEARCH

       Existing renderer is fine because
       articles now contain DB data.
    ========================================================= */

    get(
        "articleSearch"
    )?.addEventListener(
        "input",
        event => {

            event.stopImmediatePropagation();

            renderArticles();

        },
        true
    );


    get(
        "topSearch"
    )?.addEventListener(
        "input",
        event => {

            event.stopImmediatePropagation();


            if (
                get(
                    "articleSearch"
                )
            ) {

                get(
                    "articleSearch"
                ).value =
                    event.target.value;
            }


            renderArticles();

        },
        true
    );


    /* =========================================================
       TOAST
    ========================================================= */

    function showLiveToast(
        message
    ) {

        const toast =
            get(
                "toast"
            );


        if (!toast) {

            console.log(
                message
            );

            return;
        }


        toast.textContent =
            message;


        toast.classList.add(
            "show"
        );


        clearTimeout(
            liveToastTimer
        );


        liveToastTimer =
            setTimeout(
                () => {

                    toast.classList
                        .remove(
                            "show"
                        );

                },
                2400
            );
    }


    /* =========================================================
       INIT
    ========================================================= */

    async function init() {

        try {

            await loadUser();

            await loadKnowledge();

        } catch (
            error
        ) {

            console.error(
                "❌ Knowledge Base:",
                error
            );


            showLiveToast(
                error.message
            );
        }
    }


    init();

})();