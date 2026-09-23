(function () {

    "use strict";


    let assignmentTickets =
        [];


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

            window.location.replace(
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

            window.location.replace(
                "/dashboard.html"
            );

            throw new Error(
                "Administrator access required."
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


    function populateTickets() {

        const select =
            document.getElementById(
                "assignTicket"
            );


        if (!select) {
            return;
        }


        select.innerHTML = `
            <option value="">
                Select ticket
            </option>

            ${
                assignmentTickets
                    .map(
                        ticket => `

                            <option
                                value="${escapeHtml(
                                    ticket.id
                                )}"
                                data-department="${escapeHtml(
                                    ticket.department ||
                                    ""
                                )}"
                            >
                                ${escapeHtml(
                                    ticket.ticketNumber
                                )}
                                —
                                ${escapeHtml(
                                    ticket.subject
                                )}
                                ${
                                    ticket.assigneeName
                                        ? ` — ${escapeHtml(
                                            ticket.assigneeName
                                        )}`
                                        : ""
                                }
                            </option>
                        `
                    )
                    .join("")
            }
        `;
    }


    function rebuildSpecializations() {

        const select =
            document.getElementById(
                "specializationFilter"
            );


        if (!select) {
            return;
        }


        const current =
            select.value;


        const values =
            [
                ...new Set(
                    technicians.flatMap(
                        technician =>
                            technician.specializations ||
                            []
                    )
                )
            ]
                .filter(Boolean)
                .sort();


        select.innerHTML = `
            <option value="">
                All Specializations
            </option>

            ${
                values.map(
                    value => `
                        <option
                            value="${escapeHtml(
                                value
                            )}"
                        >
                            ${escapeHtml(
                                value
                            )}
                        </option>
                    `
                ).join("")
            }
        `;


        if (
            values.includes(
                current
            )
        ) {

            select.value =
                current;
        }
    }


    async function loadLive() {

        const data =
            await api(
                "/api/technicians"
            );


        technicians =
            Array.isArray(
                data.technicians
            )
                ? data.technicians
                : [];


        assignmentTickets =
            Array.isArray(
                data.assignmentTickets
            )
                ? data.assignmentTickets
                : [];


        rebuildSpecializations();

        populateTickets();


        if (
            typeof populateTechnicians ===
            "function"
        ) {

            populateTechnicians();
        }


        if (
            typeof renderTechnicians ===
            "function"
        ) {

            renderTechnicians();
        }


        if (
            typeof updateStats ===
            "function"
        ) {

            updateStats();
        }


        console.log(
            "✅ Live technicians:",
            technicians
        );
    }


    const form =
        document.getElementById(
            "assignForm"
        );


    form?.addEventListener(
        "submit",
        async event => {

            event.preventDefault();

            event.stopImmediatePropagation();


            const ticketId =
                document.getElementById(
                    "assignTicket"
                )?.value;


            const technicianId =
                document.getElementById(
                    "assignTechnician"
                )?.value;


            if (
                !ticketId ||
                !technicianId
            ) {

                toast(
                    "Select a ticket and technician."
                );

                return;
            }


            try {

                await api(
                    "/api/technicians/assign",
                    {

                        method:
                            "POST",

                        body:
                            JSON.stringify({

                                ticketId:
                                    Number(
                                        ticketId
                                    ),

                                technicianId:
                                    Number(
                                        technicianId
                                    )

                            })

                    }
                );


                document
                    .getElementById(
                        "assignModal"
                    )
                    ?.classList
                    .remove(
                        "open"
                    );


                document.body.style.overflow =
                    "";


                await loadLive();


                toast(
                    "Ticket assigned successfully."
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


    document
        .getElementById(
            "assignTicketButton"
        )
        ?.addEventListener(
            "click",
            () => {

                setTimeout(
                    populateTickets,
                    0
                );

            }
        );


    loadLive()
        .catch(
            error => {

                console.error(
                    "❌ Technician page:",
                    error
                );

                toast(
                    error.message
                );
            }
        );


    setInterval(
        () => {

            const assignModalOpen =
                document
                    .getElementById(
                        "assignModal"
                    )
                    ?.classList
                    .contains(
                        "open"
                    );

            const techModalOpen =
                document
                    .getElementById(
                        "techModal"
                    )
                    ?.classList
                    .contains(
                        "open"
                    );


            if (
                assignModalOpen ||
                techModalOpen
            ) {

                return;
            }


            loadLive()
                .catch(
                    console.error
                );

        },
        30000
    );

})();