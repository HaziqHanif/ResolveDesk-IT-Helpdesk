(() => {

    let user =
        null;

    let currentArticle =
        null;


    function esc(
        value
    ) {

        return String(
            value ??
            ""
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

                    headers: {
                        "Content-Type":
                            "application/json",

                        ...(
                            options.headers ||
                            {}
                        )
                    },

                    ...options
                }
            );


        const data =
            await response.json()
                .catch(
                    () => ({})
                );


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


    function toast(
        message
    ) {

        if (
            typeof showLiveToast ===
            "function"
        ) {

            showLiveToast(
                message
            );

            return;
        }


        const element =
            document.getElementById(
                "toast"
            );


        if (
            element
        ) {

            element.textContent =
                message;

            element.classList.add(
                "show"
            );


            setTimeout(
                () => {

                    element.classList.remove(
                        "show"
                    );

                },
                2500
            );
        }
    }


    function canEdit(
        article
    ) {

        if (
            !user ||
            !article
        ) {

            return false;
        }


        if (
            user.role ===
            "ADMIN"
        ) {

            return true;
        }


        return (
            user.role ===
                "TECHNICIAN" &&

            String(
                article.authorId
            ) ===
            String(
                user.id
            ) &&

            article.status ===
                "DRAFT"
        );
    }


    function canPublish() {

        return (
            user?.role ===
            "ADMIN"
        );
    }


    function closeEditModal() {

        document.getElementById(
            "kbEditModal"
        )?.remove();

    }


    async function openEditModal(
        article
    ) {

        if (
            !canEdit(
                article
            )
        ) {

            toast(
                "You cannot edit this article."
            );

            return;
        }


        closeEditModal();


        const knowledge =
            await api(
                "/api/knowledge-base"
            );


        const categories =
            Array.isArray(
                knowledge.categories
            )
                ? knowledge.categories
                : [];


        const modal =
            document.createElement(
                "div"
            );


        modal.id =
            "kbEditModal";

        modal.className =
            "modal-backdrop open";


        modal.innerHTML = `
            <div class="modal">

                <div class="modal-head">

                    <div>
                        <h2>Edit Knowledge Article</h2>

                        <p>
                            ${
                                user.role ===
                                "TECHNICIAN"
                                    ? "Update your draft before administrator review."
                                    : "Update article content and publishing settings."
                            }
                        </p>
                    </div>

                    <button
                        class="close-button"
                        id="kbEditClose"
                        type="button"
                    >
                        ×
                    </button>

                </div>


                <form
                    class="form"
                    id="kbEditForm"
                >

                    <div class="field">

                        <label>
                            Article Title
                        </label>

                        <input
                            id="kbEditTitle"
                            required
                            value="${esc(
                                article.title
                            )}"
                        >

                    </div>


                    <div class="form-grid">

                        <div class="field">

                            <label>
                                Category
                            </label>

                            <select
                                id="kbEditCategory"
                            >

                                <option value="">
                                    Uncategorised
                                </option>

                                ${
                                    categories
                                        .map(
                                            category => `
                                                <option
                                                    value="${esc(
                                                        category.id
                                                    )}"
                                                    ${
                                                        String(
                                                            category.id
                                                        ) ===
                                                        String(
                                                            article.categoryId ||
                                                            ""
                                                        )
                                                            ? "selected"
                                                            : ""
                                                    }
                                                >
                                                    ${esc(
                                                        category.name
                                                    )}
                                                </option>
                                            `
                                        )
                                        .join("")
                                }

                            </select>

                        </div>


                        <div class="field">

                            <label>
                                Visibility
                            </label>

                            <select
                                id="kbEditVisibility"
                            >

                                <option
                                    value="ALL_STAFF"
                                    ${
                                        article.visibility ===
                                        "ALL_STAFF"
                                            ? "selected"
                                            : ""
                                    }
                                >
                                    All Staff
                                </option>

                                <option
                                    value="TECHNICIANS_ONLY"
                                    ${
                                        article.visibility ===
                                        "TECHNICIANS_ONLY"
                                            ? "selected"
                                            : ""
                                    }
                                >
                                    Technicians Only
                                </option>

                                ${
                                    user.role ===
                                    "ADMIN"
                                        ? `
                                            <option
                                                value="ADMINISTRATORS_ONLY"
                                                ${
                                                    article.visibility ===
                                                    "ADMINISTRATORS_ONLY"
                                                        ? "selected"
                                                        : ""
                                                }
                                            >
                                                Administrators Only
                                            </option>
                                        `
                                        : ""
                                }

                            </select>

                        </div>

                    </div>


                    <div class="field">

                        <label>
                            Summary
                        </label>

                        <textarea
                            id="kbEditSummary"
                            required
                        >${esc(
                            article.summary
                        )}</textarea>

                    </div>


                    <div class="field">

                        <label>
                            Content
                        </label>

                        <textarea
                            id="kbEditContent"
                            required
                        >${esc(
                            article.content
                        )}</textarea>

                    </div>


                    <div class="modal-actions">

                        <button
                            class="secondary-button"
                            id="kbEditCancel"
                            type="button"
                        >
                            Cancel
                        </button>

                        <button
                            class="primary-button"
                            type="submit"
                        >
                            Save Changes
                        </button>

                    </div>

                </form>

            </div>
        `;


        document.body.appendChild(
            modal
        );


        document.getElementById(
            "kbEditClose"
        )?.addEventListener(
            "click",
            closeEditModal
        );


        document.getElementById(
            "kbEditCancel"
        )?.addEventListener(
            "click",
            closeEditModal
        );


        modal.addEventListener(
            "click",
            event => {

                if (
                    event.target ===
                    modal
                ) {

                    closeEditModal();
                }
            }
        );


        document.getElementById(
            "kbEditForm"
        )?.addEventListener(
            "submit",
            async event => {

                event.preventDefault();


                try {

                    await api(
                        `/api/knowledge-base/${encodeURIComponent(
                            article.id
                        )}`,
                        {
                            method:
                                "PUT",

                            body:
                                JSON.stringify({
                                    title:
                                        document.getElementById(
                                            "kbEditTitle"
                                        ).value.trim(),

                                    summary:
                                        document.getElementById(
                                            "kbEditSummary"
                                        ).value.trim(),

                                    content:
                                        document.getElementById(
                                            "kbEditContent"
                                        ).value.trim(),

                                    categoryId:
                                        document.getElementById(
                                            "kbEditCategory"
                                        ).value ||
                                        null,

                                    visibility:
                                        document.getElementById(
                                            "kbEditVisibility"
                                        ).value
                                })
                        }
                    );


                    toast(
                        "Knowledge article updated."
                    );


                    setTimeout(
                        () => {

                            window.location.reload();

                        },
                        500
                    );

                } catch (
                    error
                ) {

                    toast(
                        error.message
                    );
                }
            }
        );
    }


    async function publishArticle(
        article
    ) {

        if (
            !canPublish()
        ) {

            return;
        }


        try {

            await api(
                `/api/knowledge-base/${encodeURIComponent(
                    article.id
                )}`,
                {
                    method:
                        "PUT",

                    body:
                        JSON.stringify({
                            status:
                                "PUBLISHED"
                        })
                }
            );


            toast(
                "Knowledge article published."
            );


            setTimeout(
                () => {

                    window.location.reload();

                },
                500
            );

        } catch (
            error
        ) {

            toast(
                error.message
            );
        }
    }


    async function archiveArticle(
        article
    ) {

        if (
            !canPublish()
        ) {

            return;
        }


        if (
            !window.confirm(
                `Archive "${article.title}"?`
            )
        ) {

            return;
        }


        try {

            await api(
                `/api/knowledge-base/${encodeURIComponent(
                    article.id
                )}`,
                {
                    method:
                        "DELETE"
                }
            );


            toast(
                "Knowledge article archived."
            );


            setTimeout(
                () => {

                    window.location.reload();

                },
                500
            );

        } catch (
            error
        ) {

            toast(
                error.message
            );
        }
    }


    function addManagementActions(
        article
    ) {

        const container =
            document.getElementById(
                "articleView"
            );


        if (
            !container ||
            !article
        ) {

            return;
        }


        container
            .querySelector(
                ".kb-management-actions"
            )
            ?.remove();


        const editable =
            canEdit(
                article
            );


        const admin =
            canPublish();


        if (
            !editable &&
            !admin
        ) {

            return;
        }


        const actions =
            document.createElement(
                "div"
            );


        actions.className =
            "kb-management-actions";

        actions.style.display =
            "flex";

        actions.style.flexWrap =
            "wrap";

        actions.style.gap =
            "10px";

        actions.style.marginTop =
            "22px";


        const status =
            document.createElement(
                "span"
            );


        status.textContent =
            `Status: ${
                article.status ||
                "PUBLISHED"
            }`;

        status.style.marginRight =
            "auto";

        status.style.fontWeight =
            "700";


        actions.appendChild(
            status
        );


        if (
            editable
        ) {

            const edit =
                document.createElement(
                    "button"
                );


            edit.type =
                "button";

            edit.className =
                "secondary-button";

            edit.textContent =
                "Edit Article";


            edit.addEventListener(
                "click",
                () => {

                    openEditModal(
                        article
                    );
                }
            );


            actions.appendChild(
                edit
            );
        }


        if (
            admin &&
            article.status !==
                "PUBLISHED"
        ) {

            const publish =
                document.createElement(
                    "button"
                );


            publish.type =
                "button";

            publish.className =
                "primary-button";

            publish.textContent =
                "Publish";


            publish.addEventListener(
                "click",
                () => {

                    publishArticle(
                        article
                    );
                }
            );


            actions.appendChild(
                publish
            );
        }


        if (
            admin
        ) {

            const archive =
                document.createElement(
                    "button"
                );


            archive.type =
                "button";

            archive.className =
                "secondary-button";

            archive.textContent =
                "Archive";


            archive.addEventListener(
                "click",
                () => {

                    archiveArticle(
                        article
                    );
                }
            );


            actions.appendChild(
                archive
            );
        }


        container.appendChild(
            actions
        );
    }


    async function initialize() {

        try {

            const me =
                await api(
                    "/api/auth/me"
                );


            user =
                me.user ||
                null;


            if (
                !user
            ) {

                return;
            }


            /*
                Technician create modal:
                change wording to Draft.
            */

            if (
                user.role ===
                "TECHNICIAN"
            ) {

                const createSubmit =
                    document.querySelector(
                        "#articleForm button[type='submit']"
                    );


                if (
                    createSubmit
                ) {

                    createSubmit.textContent =
                        "Save Draft";
                }
            }


            /*
                Wrap existing article viewer.
            */

            const original =
                window.openArticle;


            if (
                typeof original !==
                "function"
            ) {

                return;
            }


            window.openArticle =
                async function (
                    id
                ) {

                    await original(
                        id
                    );


                    let article =
                        null;


                    try {

                        if (
                            typeof articles !==
                            "undefined" &&
                            Array.isArray(
                                articles
                            )
                        ) {

                            article =
                                articles.find(
                                    item =>
                                        String(
                                            item.id
                                        ) ===
                                        String(
                                            id
                                        )
                                );
                        }

                    } catch (
                        error
                    ) {

                        article =
                            null;
                    }


                    currentArticle =
                        article;


                    addManagementActions(
                        currentArticle
                    );
                };


        } catch (
            error
        ) {

            console.error(
                "KB role management error:",
                error
            );
        }
    }


    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            initialize,
            {
                once:
                    true
            }
        );

    } else {

        initialize();
    }

})();
