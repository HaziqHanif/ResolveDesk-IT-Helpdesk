(function () {

    "use strict";


    let headOptions =
        [];


    function get(id) {

        return document.getElementById(
            id
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
            response.status ===
            403
        ) {

            location.replace(
                "/dashboard.html"
            );

            throw new Error(
                "Administrator access required."
            );
        }


        if (!response.ok) {

            throw new Error(
                data.message ||
                "Request failed."
            );
        }


        return data;
    }


    function escapeHtml(
        value
    ) {

        return String(
            value ?? ""
        )
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }


    function toast(
        message
    ) {

        if (
            typeof showToast ===
            "function"
        ) {

            showToast(
                message
            );

            return;
        }


        console.log(
            message
        );
    }


    function installHeadSelect() {

        let field =
            get(
                "departmentHead"
            );


        if (!field) {
            return;
        }


        if (
            field.tagName !==
            "SELECT"
        ) {

            const select =
                document.createElement(
                    "select"
                );


            select.id =
                field.id;


            select.className =
                field.className;


            if (
                field.name
            ) {

                select.name =
                    field.name;
            }


            field.replaceWith(
                select
            );


            field =
                select;
        }


        const selected =
            field.value;


        field.innerHTML = `
            <option value="">
                No department head
            </option>

            ${
                headOptions.map(
                    user => `
                        <option
                            value="${escapeHtml(
                                user.id
                            )}"
                        >
                            ${escapeHtml(
                                user.name
                            )}
                            — ${escapeHtml(
                                user.role
                            )}
                        </option>
                    `
                ).join("")
            }
        `;


        if (
            headOptions.some(
                user =>
                    String(
                        user.id
                    ) ===
                    String(
                        selected
                    )
            )
        ) {

            field.value =
                selected;
        }


        field.onchange =
            updateHeadEmail;
    }


    function updateHeadEmail() {

        const value =
            get(
                "departmentHead"
            )?.value;


        const user =
            headOptions.find(
                item =>
                    String(
                        item.id
                    ) ===
                    String(
                        value
                    )
            );


        const email =
            get(
                "departmentEmail"
            );


        if (email) {

            email.value =
                user?.email ||
                "";

            email.readOnly =
                true;
        }
    }


    function markComputedFields() {

        const members =
            get(
                "departmentMembers"
            );

        const sla =
            get(
                "departmentSla"
            );


        if (members) {

            members.readOnly =
                true;
        }


        if (sla) {

            sla.readOnly =
                true;
        }


        const email =
            get(
                "departmentEmail"
            );


        if (email) {

            email.readOnly =
                true;
        }
    }


    async function loadLive() {

        const data =
            await api(
                "/api/departments"
            );


        departments =
            Array.isArray(
                data.departments
            )
                ? data.departments
                : [];


        headOptions =
            Array.isArray(
                data.headOptions
            )
                ? data.headOptions
                : [];


        installHeadSelect();

        markComputedFields();


        if (
            typeof renderDepartments ===
            "function"
        ) {

            renderDepartments();
        }


        if (
            typeof updateStats ===
            "function"
        ) {

            updateStats();
        }


        console.log(
            "✅ Live departments:",
            departments
        );
    }


    /*
        Override old demo edit function.
    */

    window.editDepartment =
        function (
            id
        ) {

            const department =
                departments.find(
                    item =>
                        String(
                            item.id
                        ) ===
                        String(
                            id
                        )
                );


            if (!department) {
                return;
            }


            get(
                "departmentModalTitle"
            ).textContent =
                "Edit Department";


            get(
                "editingDepartmentId"
            ).value =
                department.id;


            get(
                "departmentName"
            ).value =
                department.name;


            get(
                "departmentCode"
            ).value =
                department.code;


            const description =
                get(
                    "departmentDescription"
                );

            if (description) {

                description.value =
                    department.description ||
                    "";
            }


            const status =
                get(
                    "departmentStatus"
                );

            if (status) {

                status.value =
                    department.isActive === false
                        ? "inactive"
                        : "active";
            }


            installHeadSelect();


            get(
                "departmentHead"
            ).value =
                department.headUserId ||
                "";


            get(
                "departmentEmail"
            ).value =
                department.email === "—"
                    ? ""
                    : department.email;


            get(
                "departmentMembers"
            ).value =
                department.members;


            get(
                "departmentSla"
            ).value =
                department.sla;


            if (
                typeof openDepartmentModal ===
                "function"
            ) {

                openDepartmentModal();

            } else {

                get(
                    "departmentModal"
                )?.classList.add(
                    "open"
                );
            }
        };


    get(
        "departmentForm"
    )?.addEventListener(
        "submit",
        async event => {

            event.preventDefault();

            event.stopImmediatePropagation();


            const editingId =
                get(
                    "editingDepartmentId"
                )?.value;


            const name =
                get(
                    "departmentName"
                )?.value.trim();


            const code =
                get(
                    "departmentCode"
                )?.value.trim();


            const headUserId =
                get(
                    "departmentHead"
                )?.value ||
                null;


            const description =
                get(
                    "departmentDescription"
                )?.value.trim() ||
                "";


            const isActive =
                get(
                    "departmentStatus"
                )?.value !==
                "inactive";


            if (
                !name ||
                !code
            ) {

                toast(
                    "Department name and code are required."
                );

                return;
            }


            try {

                await api(
                    editingId
                        ? `/api/departments/${encodeURIComponent(
                            editingId
                        )}`
                        : "/api/departments",
                    {

                        method:
                            editingId
                                ? "PUT"
                                : "POST",

                        body:
                            JSON.stringify({

                                name,

                                code,

                                headUserId:
                                    headUserId
                                        ? Number(
                                            headUserId
                                        )
                                        : null,

                                description,

                                isActive

                            })

                    }
                );


                if (
                    typeof closeDepartmentModal ===
                    "function"
                ) {

                    closeDepartmentModal();

                } else {

                    get(
                        "departmentModal"
                    )?.classList.remove(
                        "open"
                    );
                }


                await loadLive();


                toast(
                    editingId
                        ? "Department updated."
                        : "Department created."
                );

            } catch (
                error
            ) {

                toast(
                    error.message
                );
            }

        },
        true
    );


    get(
        "addDepartmentButton"
    )?.addEventListener(
        "click",
        () => {

            setTimeout(
                () => {

                    installHeadSelect();

                    get(
                        "departmentHead"
                    ).value =
                        "";


                    const description =
                        get(
                            "departmentDescription"
                        );

                    if (description) {

                        description.value =
                            "";
                    }


                    const status =
                        get(
                            "departmentStatus"
                        );

                    if (status) {

                        status.value =
                            "active";
                    }


                    const members =
                        get(
                            "departmentMembers"
                        );

                    if (members) {

                        members.value =
                            "0";
                    }


                    const sla =
                        get(
                            "departmentSla"
                        );

                    if (sla) {

                        sla.value =
                            "0";
                    }


                    updateHeadEmail();

                },
                0
            );

        }
    );


    loadLive()
        .catch(
            error => {

                console.error(
                    "❌ Department page:",
                    error
                );

                toast(
                    error.message
                );
            }
        );

})();